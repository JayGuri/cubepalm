import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { parseCubeMove } from '../core/animation/parseCubeMove'
import { moveFromDrag, AXIS_INDEX, type Axis, type DragInput } from '../core/gestures/MouseDragAdapter'
import type { GestureFeed } from '../core/gestures/useHandGestures'
import { MoveArrow } from './MoveArrow'
import { orbitFromHand } from '../core/gestures/handOrbit'
import { pieceBox } from '../core/puzzles/mirror/geometry'
import { currentSlot, mirrorPiecesOf } from '../core/puzzles/mirror/pieces'
import { applyColorblindPaletteToColors } from '../core/puzzles/colorblindPalette'
import type { Move, PuzzleMesh, PuzzlePlugin, PuzzleState } from '../core/puzzles/PuzzlePlugin'

const PLASTIC = '#14161F'
// Fraction of each piece's own slot distance from centre used as its visual
// gap offset (see the render loop below) -- proportional, not a fixed unit
// count, so it looks right across cube3's ~1.5-unit half-extent and
// megaminx's ~1-unit dodecahedron alike. Widened from 0.045 on user feedback
// that the seams read as too thin to feel like a real cube's black plastic.
const GAP_FRACTION = 0.075
// How long a single quarter/half turn takes to visually rotate into place.
const MOVE_DURATION_MS = 220

const AXIS_VECTOR: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
}
const IDENTITY_QUATERNION = new THREE.Quaternion()
const DIM_TOWARD = new THREE.Color('#16171B')
const dim = (hex: string) => `#${new THREE.Color(hex).lerp(DIM_TOWARD, 0.3).getHexString()}`

// ---- The 3x3's look: a dark plastic cubie with a rounded sticker on each outer
// face, like a real cube. Every cubie shares one body material and one sticker
// shape, and stickers of the same colour share a material, so the whole cube is
// a handful of materials instead of the 182 it used to create.
const STICKER_SIZE = 0.86
const STICKER_RADIUS = 0.15
// Just proud of the body's surface, so the two never fight for the same depth.
const STICKER_LIFT = 0.506
const NO_RAYCAST = () => null
const STICKER_PLACEMENT: Record<string, { normal: [number, number, number]; rotation: [number, number, number] }> = {
  R: { normal: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
  L: { normal: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  U: { normal: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
  D: { normal: [0, -1, 0], rotation: [Math.PI / 2, 0, 0] },
  F: { normal: [0, 0, 1], rotation: [0, 0, 0] },
  B: { normal: [0, 0, -1], rotation: [0, Math.PI, 0] },
}

let stickerShape: THREE.ShapeGeometry | null = null
function stickerGeometry(): THREE.ShapeGeometry {
  if (stickerShape) return stickerShape
  const h = STICKER_SIZE / 2
  const r = STICKER_RADIUS
  const shape = new THREE.Shape()
  shape.moveTo(-h + r, -h)
  shape.lineTo(h - r, -h)
  shape.quadraticCurveTo(h, -h, h, -h + r)
  shape.lineTo(h, h - r)
  shape.quadraticCurveTo(h, h, h - r, h)
  shape.lineTo(-h + r, h)
  shape.quadraticCurveTo(-h, h, -h, h - r)
  shape.lineTo(-h, -h + r)
  shape.quadraticCurveTo(-h, -h, -h + r, -h)
  stickerShape = new THREE.ShapeGeometry(shape, 6)
  return stickerShape
}

const stickerMaterials = new Map<string, THREE.MeshStandardMaterial>()
function stickerMaterial(hex: string): THREE.MeshStandardMaterial {
  let material = stickerMaterials.get(hex)
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.42, metalness: 0 })
    stickerMaterials.set(hex, material)
  }
  return material
}

let cubieBody: THREE.MeshStandardMaterial | null = null
function bodyMaterial(): THREE.MeshStandardMaterial {
  cubieBody ??= new THREE.MeshStandardMaterial({ color: '#0B0C10', roughness: 0.6, metalness: 0.05 })
  return cubieBody
}

// Fine light/dark streaks, multiplied over the Mirror Cube's blue, read as
// brushed metal. Drawn once on a canvas and shared by every tile.
// Every Mirror piece shares these three materials instead of making its own.
let sharedMirror: { body: THREE.Material; tile: THREE.Material; dim: THREE.Material } | null = null
function mirrorMaterials() {
  if (!sharedMirror) {
    const tile = (color: string) =>
      new THREE.MeshStandardMaterial({ color, map: brushedTexture(), metalness: 0.9, roughness: 0.22, envMapIntensity: 1.25 })
    sharedMirror = {
      body: new THREE.MeshStandardMaterial({ color: PLASTIC, roughness: 0.85 }),
      tile: tile('#8FB4FF'),
      dim: tile('#5A78C4'),
    }
  }
  return sharedMirror
}

let brushed: THREE.CanvasTexture | null = null
function brushedTexture(): THREE.CanvasTexture {
  if (brushed) return brushed
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#d8d8d8'
  g.fillRect(0, 0, 256, 256)
  for (let y = 0; y < 256; y++) {
    const v = 222 + Math.floor(Math.random() * 33)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(0, y, 256, 1)
  }
  brushed = new THREE.CanvasTexture(c)
  brushed.colorSpace = THREE.SRGBColorSpace
  return brushed
}

// Standard ease-in-out: starts and ends the turn gently instead of snapping
// to/from a constant speed, which read as mechanical/jerky.
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

interface DragStart {
  normal: [number, number, number]
  slot: [number, number, number]
  x: number
  y: number
}

// The subset of drei's OrbitControls ref (a three-stdlib OrbitControls
// instance under the hood) that the gesture-driven camera nudge needs.
interface OrbitControlsHandle {
  enabled: boolean
  object: THREE.Camera
  target: THREE.Vector3
  update: () => void
}

// Screen-space direction of each puzzle axis under the live camera, which is
// what turns a 2D drag into a 3D rotation axis.
function axisScreenDirs(camera: THREE.Camera): Record<Axis, [number, number]> {
  const origin = new THREE.Vector3(0, 0, 0).project(camera)
  const dirFor = (v: THREE.Vector3): [number, number] => {
    const p = v.clone().project(camera)
    // Screen y grows downward; NDC y grows upward.
    return [p.x - origin.x, -(p.y - origin.y)]
  }
  return {
    x: dirFor(new THREE.Vector3(1, 0, 0)),
    y: dirFor(new THREE.Vector3(0, 1, 0)),
    z: dirFor(new THREE.Vector3(0, 0, 1)),
  }
}

interface PiecesProps {
  plugin: PuzzlePlugin
  mesh: PuzzleMesh
  state: PuzzleState
  onMove: (move: Move | null) => void
  interactive: boolean
  setOrbitEnabled: (enabled: boolean) => void
  gestureFeed?: GestureFeed | null
  previewLayer?: { axis: Axis; layer: number } | null
  colorblindPalette?: boolean
  colorRemap?: Record<string, string>
  turnMs?: number
  // The move currently being visually turned, or null when nothing is
  // animating. Colours stay on the PRE-move state until the rotation
  // finishes, then snap to `state` and onAnimationComplete fires -- see the
  // useFrame loop below for how the two stay in lockstep.
  animatingMove?: Move | null
  onAnimationComplete?: () => void
  // The gesture FSM's ORBIT/ZOOM events are camera-only concerns (an open
  // hand moving, or two open hands moving apart/together) -- there is no
  // puzzle Move to produce, so they bypass intentFromGestureEvent entirely
  // and nudge the camera directly, the same way OrbitControls does for mouse
  // drag/wheel.
  onGestureOrbit?: (dx: number, dy: number) => void
  onGestureZoom?: (delta: number) => void
}

function Pieces({
  plugin,
  mesh,
  state,
  onMove,
  interactive,
  setOrbitEnabled,
  gestureFeed,
  previewLayer,
  colorblindPalette,
  colorRemap,
  turnMs = MOVE_DURATION_MS,
  animatingMove,
  onAnimationComplete,
  onGestureOrbit,
  onGestureZoom,
}: PiecesProps) {
  const { camera, invalidate } = useThree()
  // Material group order is derived from the plugin's own colorScheme keys,
  // not a hardcoded cube3 face list -- the geometry builder (per-puzzle
  // geometry.ts) always numbers groups 0..N-1 in this same key order, with N
  // the trailing interior/plastic group, so this works unchanged for any
  // puzzle's face count.
  const faceKeys = useMemo(() => Object.keys(plugin.colorScheme), [plugin])

  // Colours are computed from `colorState`, not the live `state` prop
  // directly: while a move animates, `state` has already flipped (the store
  // updates synchronously) but the pieces must keep showing the PRE-move
  // colours until the rotation finishes, or the sticker pattern would jump to
  // its final arrangement before the pieces visually got there.
  const [colorState, setColorState] = useState(state)
  const stateRef = useRef(state)
  stateRef.current = state
  const turnMsRef = useRef(turnMs)
  useEffect(() => {
    turnMsRef.current = turnMs
  }, [turnMs])
  const onAnimationCompleteRef = useRef(onAnimationComplete)
  onAnimationCompleteRef.current = onAnimationComplete

  // Any state change NOT accompanied by an animatingMove (Reset, Undo, a
  // scramble jump, switching puzzles) has nothing to animate toward, so it
  // must be reflected immediately rather than waiting for a rotation that
  // will never start.
  useEffect(() => {
    if (!animatingMove) setColorState(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mesh])

  const colors = useMemo(() => {
    const raw = plugin.faceletColors(colorState)
    if (!colorblindPalette && !colorRemap) return raw
    const out = new Map<string, Record<string, string>>()
    for (const [id, faceColors] of raw) {
      const shown = colorRemap
        ? Object.fromEntries(Object.entries(faceColors).map(([face, hex]) => [face, colorRemap[hex] ?? hex]))
        : faceColors
      out.set(id, colorblindPalette ? applyColorblindPaletteToColors(shown) : shown)
    }
    return out
  }, [plugin, colorState, colorblindPalette, colorRemap])

  const pieceGroupRefs = useRef(new Map<string, THREE.Group>())
  const activeAnim = useRef<{ axis: Axis; layer: -1 | 0 | 1; angle: number; startedAt: number } | null>(null)

  // Where each piece is drawn and how it is turned. A 3x3 never moves its
  // meshes -- it repaints stickers -- so every piece stays at its own slot,
  // unrotated. A Mirror Cube has no stickers: its pieces' SHAPES must travel,
  // so each one is drawn at the slot and rotation its piece tracker reports.
  const isMirror = plugin.id === 'mirror'
  const poses = useMemo(() => {
    const out = new Map<string, { slot: [number, number, number]; base: THREE.Quaternion }>()
    if (!isMirror) {
      for (const p of mesh.pieces) out.set(p.pieceId, { slot: p.slot, base: IDENTITY_QUATERNION })
      return out
    }
    for (const t of mirrorPiecesOf(colorState)) {
      const r = t.rotation
      const m = new THREE.Matrix4().set(r[0][0], r[0][1], r[0][2], 0, r[1][0], r[1][1], r[1][2], 0, r[2][0], r[2][1], r[2][2], 0, 0, 0, 0, 1)
      out.set(`mirror-${t.home[0]}_${t.home[1]}_${t.home[2]}`, {
        slot: currentSlot(t),
        base: new THREE.Quaternion().setFromRotationMatrix(m),
      })
    }
    return out
  }, [isMirror, mesh, colorState])
  const posesRef = useRef(poses)
  posesRef.current = poses

  // A NEW animatingMove means a move just landed in the store. Figure out
  // whether it is one this renderer knows how to visually turn (cube3 and
  // mastermorphix's shared R/L/U/D/F/B/M/E/S notation); anything else (the
  // other four puzzles have their own notations) snaps instantly, same as
  // before animation existed at all.
  //
  // handledMoveRef guards against React StrictMode's dev-only double-invoke
  // of effects: without it, the same `animatingMove` object started this
  // effect twice, and for puzzles with no animation (parsed === null) that
  // fired onAnimationComplete twice for one move -- the second, spurious
  // call resolved the QUEUE's promise for whichever move had since become
  // current, letting the solve loop race ahead and re-run stale moves.
  // Confirmed by megaminx's solve applying 117 moves instead of the expected
  // 26 in an E2E run, only under the dev server (StrictMode is dev-only).
  const handledMoveRef = useRef<Move | null>(null)
  useEffect(() => {
    if (!animatingMove) {
      // The turn was called off (Reset, a new scramble, the watchdog): stop
      // drawing it, so its ending can't be mistaken for the next turn's.
      if (activeAnim.current) {
        activeAnim.current = null
        for (const [pieceId, group] of pieceGroupRefs.current) {
          const pose = posesRef.current.get(pieceId)
          if (pose) group.quaternion.copy(pose.base)
        }
      }
      return
    }
    if (handledMoveRef.current === animatingMove) return
    handledMoveRef.current = animatingMove
    const parsed = parseCubeMove(animatingMove.alg.toString())
    if (!parsed) {
      setColorState(stateRef.current)
      onAnimationCompleteRef.current?.()
      return
    }
    activeAnim.current = { ...parsed, startedAt: performance.now() }
    invalidate()
  }, [animatingMove, invalidate])

  useFrame(() => {
    const anim = activeAnim.current
    if (!anim) return
    // The canvas only draws when asked; a turn in progress asks every frame.
    invalidate()
    const t = Math.min(1, (performance.now() - anim.startedAt) / turnMsRef.current)
    const angle = anim.angle * easeInOutQuad(t)
    const axisVector = AXIS_VECTOR[anim.axis]
    const axisIdx = AXIS_INDEX[anim.axis]
    const turn = new THREE.Quaternion().setFromAxisAngle(axisVector, angle)
    for (const [pieceId, group] of pieceGroupRefs.current) {
      const pose = posesRef.current.get(pieceId)
      if (!pose) continue
      if (pose.slot[axisIdx] === anim.layer) group.quaternion.copy(turn).multiply(pose.base)
      else if (!group.quaternion.equals(pose.base)) group.quaternion.copy(pose.base)
    }
    if (t >= 1) {
      activeAnim.current = null
      // A 3x3 repaints its stickers, so its pieces return to their slots. A
      // Mirror Cube's pieces stay where the turn left them: snapping back to
      // the old pose here showed one frame of the pre-turn cube, a visible
      // jerk at the end of every move, until the new poses rendered.
      if (!isMirror)
        for (const [pieceId, group] of pieceGroupRefs.current) {
          const pose = posesRef.current.get(pieceId)
          if (pose) group.quaternion.copy(pose.base)
        }
      setColorState(stateRef.current)
      onAnimationCompleteRef.current?.()
    }
  })

  const drag = useRef<DragStart | null>(null)
  const orbitRef = useRef(onGestureOrbit)
  orbitRef.current = onGestureOrbit
  const zoomRef = useRef(onGestureZoom)
  zoomRef.current = onGestureZoom

  // pointerup is bound to the window, not to the meshes: a turn drag routinely
  // ends off the piece it started on (or off the canvas entirely), and an r3f
  // pointerup only fires while the pointer is still over an object.
  useEffect(() => {
    const finish = (e: PointerEvent) => {
      const start = drag.current
      drag.current = null
      setOrbitEnabled(true)
      if (!start) return
      const input: DragInput = {
        hitNormal: start.normal,
        slot: start.slot,
        dragScreen: [e.clientX - start.x, e.clientY - start.y],
        axisScreenDirs: axisScreenDirs(camera),
      }
      onMove(moveFromDrag(input))
    }
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [camera, onMove, setOrbitEnabled])

  const handleDown = (
    e: ThreeEvent<PointerEvent>,
    slot: [number, number, number],
    base: THREE.Quaternion = IDENTITY_QUATERNION,
  ) => {
    if (!interactive) return
    // Only the left/primary button turns a layer; right-button drags are left
    // alone so OrbitControls (mouseButtons.RIGHT = ROTATE below) can always
    // orbit the camera no matter where the cursor lands on the puzzle.
    if (e.nativeEvent.button !== 0) return
    const local = e.face?.normal
    if (!local) return
    // The face normal is in the piece's own frame; a turned Mirror Cube piece
    // needs it rotated into the puzzle's frame first.
    const n = local.clone().applyQuaternion(base)
    // Only the nearest piece under the cursor should start a drag, and the
    // camera must not orbit while a layer is being turned.
    e.stopPropagation()
    setOrbitEnabled(false)
    drag.current = {
      normal: [Math.round(n.x), Math.round(n.y), Math.round(n.z)],
      slot,
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
    }
  }

  // Hand gestures only ever move the camera from inside the canvas (orbit
  // with an open hand, zoom with two); layer turns come from Signs, which
  // FreePlay feeds into the same move queue as the mouse and keyboard.
  useEffect(() => {
    if (!gestureFeed || !interactive) return
    return gestureFeed.subscribe((_frame, events) => {
      for (const event of events) {
        if (event.type === 'ORBIT') orbitRef.current?.(event.dx, event.dy)
        else if (event.type === 'ZOOM') zoomRef.current?.(event.delta)
      }
    })
  }, [gestureFeed, interactive])

  return (
    <group>
      {mesh.pieces.map((piece) => {
        const pose = poses.get(piece.pieceId)
        if (!pose) return null
        if (isMirror) {
          const isDimmed =
            !activeAnim.current &&
            previewLayer != null &&
            pose.slot[AXIS_INDEX[previewLayer.axis]] !== previewLayer.layer
          const box = pieceBox(piece.slot)
          const [sx, sy, sz] = box.size
          // A black plastic body with a brushed-blue tile on every side: each
          // tile is a slab inset across its own face but standing proud along
          // its axis, so a dark rim frames every tile like a real Mirror Cube.
          const tiles: [number, number, number][] = [
            [sx - 0.03, sy - 0.16, sz - 0.16],
            [sx - 0.16, sy - 0.03, sz - 0.16],
            [sx - 0.16, sy - 0.16, sz - 0.03],
          ]
          return (
            <group
              key={piece.pieceId}
              quaternion={pose.base}
              ref={(el) => {
                if (el) pieceGroupRefs.current.set(piece.pieceId, el)
                else pieceGroupRefs.current.delete(piece.pieceId)
              }}
            >
              <group position={box.center} onPointerDown={(e) => handleDown(e, pose.slot, pose.base)}>
                <mesh material={mirrorMaterials().body}>
                  <boxGeometry args={[sx - 0.1, sy - 0.1, sz - 0.1]} />
                </mesh>
                {tiles.map((t, i) => (
                  <mesh key={i} material={isDimmed ? mirrorMaterials().dim : mirrorMaterials().tile}>
                    <boxGeometry args={t} />
                  </mesh>
                ))}
              </group>
            </group>
          )
        }
        const faceColors = colors.get(piece.pieceId) ?? {}
        // A selected layer keeps its exact colours and everything else dims,
        // rather than the layer glowing: any glow (coloured or white) shifted
        // the stickers' hue -- green read cyan, red read pink -- right when
        // the user needs to read true colours to choose their next move.
        const isDimmed =
          !activeAnim.current &&
          previewLayer != null &&
          piece.slot[AXIS_INDEX[previewLayer.axis]] !== previewLayer.layer
        // A solved face is one uniform colour with no gap between cubies, so
        // it renders as a single solid block and the puzzle reads as static
        // plastic rather than a twisty puzzle. Nudging each piece slightly
        // outward along its own slot direction (proportional to the puzzle's
        // own scale, not a fixed constant) reveals real seams between pieces
        // without needing any puzzle-specific axis knowledge.
        const gapOffset = piece.slot.map((v) => v * GAP_FRACTION) as [number, number, number]
        return (
          <group
            key={piece.pieceId}
            position={gapOffset}
            ref={(el) => {
              if (el) pieceGroupRefs.current.set(piece.pieceId, el)
              else pieceGroupRefs.current.delete(piece.pieceId)
            }}
          >
            {/* The dark plastic body takes the pointer; the stickers are paint on top of it. */}
            <mesh
              geometry={piece.geometry}
              material={bodyMaterial()}
              userData={{ slot: piece.slot }}
              onPointerDown={(e) => handleDown(e, piece.slot)}
            />
            {faceKeys.map((face) => {
              const hex = faceColors[face]
              const placement = STICKER_PLACEMENT[face]
              if (!hex || !placement) return null
              return (
                <mesh
                  key={face}
                  geometry={stickerGeometry()}
                  material={stickerMaterial(isDimmed ? dim(hex) : hex)}
                  position={[
                    piece.slot[0] + placement.normal[0] * STICKER_LIFT,
                    piece.slot[1] + placement.normal[1] * STICKER_LIFT,
                    piece.slot[2] + placement.normal[2] * STICKER_LIFT,
                  ]}
                  rotation={placement.rotation}
                  raycast={NO_RAYCAST}
                />
              )
            })}
          </group>
        )
      })}
    </group>
  )
}

export interface PuzzleCanvasProps {
  plugin: PuzzlePlugin
  state: PuzzleState
  onMove: (move: Move | null) => void
  // Preview mode renders a still, non-interactive thumbnail.
  interactive?: boolean
  className?: string
  // Live hand-gesture events (camera orbit/zoom), from useHandGestures.
  gestureFeed?: GestureFeed | null
  colorblindPalette?: boolean
  // Shows some colours as others (hex to hex). The Academy flips the cube so
  // the white layer sits at the bottom, without changing the cube itself.
  colorRemap?: Record<string, string>
  // How long one quarter turn takes, in milliseconds.
  turnMs?: number
  // The move currently animating and a callback for when it finishes turning
  // (see Pieces above). Callers that don't pass these (previews) just snap instantly.
  animatingMove?: Move | null
  onAnimationComplete?: () => void
  // Freezes the view: no camera rotation or zoom from mouse, wheel or hand
  // gestures. Layer turns are unaffected -- the point is to hold the cube
  // still while solving.
  cameraLocked?: boolean
  // Glows every piece of the layer a hand sign has selected, before it turns.
  previewLayer?: { axis: Axis; layer: number } | null
  // Notation of the next guided-solve step: draws a curved arrow around that
  // layer, sweeping the way it should turn. Hidden while a move animates.
  guideMove?: string | null
}

function PuzzleCanvasInner({
  plugin,
  state,
  onMove,
  interactive = true,
  className,
  gestureFeed,
  colorblindPalette,
  colorRemap,
  turnMs,
  animatingMove,
  onAnimationComplete,
  cameraLocked = false,
  previewLayer = null,
  guideMove = null,
  onContextRestored,
}: PuzzleCanvasProps & { onContextRestored?: () => void }) {
  const mesh = useMemo(() => plugin.buildGeometry(), [plugin])
  // The camera is framed for cube3's ~2.6-unit half-diagonal. Pyraminx and
  // Megaminx use a unit-radius base solid, so without this they rendered at
  // barely a third of cube3's on-screen size -- confirmed by screenshot, not
  // a theoretical concern. Normalising every puzzle's overall extent to the
  // same target radius keeps one fixed camera framing working for all five.
  const scale = useMemo(() => {
    // Mirror pieces are placed at their own offsets (see Pieces), not baked
    // into their geometry, so measuring geometry alone would undercount the
    // puzzle's size. It is already a 3x3x3 cuboid, cube3's own scale.
    if (plugin.id === 'mirror') return 1
    const box = new THREE.Box3()
    for (const piece of mesh.pieces) {
      piece.geometry.computeBoundingBox()
      if (piece.geometry.boundingBox) box.union(piece.geometry.boundingBox)
    }
    const size = box.getSize(new THREE.Vector3())
    const radius = size.length() / 2
    const TARGET_RADIUS = 2.6 // cube3's own natural half-diagonal
    return radius > 1e-6 ? TARGET_RADIUS / radius : 1
  }, [mesh, plugin.id])
  // Raycasting only works once the renderer exists; tests and any future
  // loading state need a real signal for that rather than a guessed delay.
  const [ready, setReady] = useState(false)
  const controls = useRef<OrbitControlsHandle | null>(null)
  const setOrbitEnabled = (enabled: boolean) => {
    if (controls.current) controls.current.enabled = enabled
  }

  // Mouse orbit/zoom are handled by OrbitControls itself (pointer/wheel
  // events on the canvas). The gesture FSM's ORBIT/ZOOM events have no DOM
  // pointer to synthesize, so they nudge the same camera directly -- same
  // spherical-coordinate approach OrbitControls uses internally, clamped to
  // the same polar/distance limits so a hand can never flip the camera
  // upside down or fly through the puzzle. `dx`/`dy`/`delta` are per-frame
  // deltas in the gesture's normalised [0,1] hand-tracking space, not
  // screen pixels, so the sensitivity constants below are a reasonable
  // starting point tuned by feel rather than measured against a real
  // camera -- if hand-orbit feels too twitchy or too sluggish once someone
  // can actually test it live, these are the two numbers to adjust.
  const nudgeOrbit = (dx: number, dy: number) => {
    const ctrl = controls.current
    if (!ctrl || cameraLocked) return
    ctrl.object.position.copy(orbitFromHand(ctrl.object.position, ctrl.target, dx, dy))
    ctrl.object.lookAt(ctrl.target)
    ctrl.update()
  }

  const nudgeZoom = (delta: number) => {
    const ctrl = controls.current
    if (!ctrl || cameraLocked) return
    const ZOOM_SENSITIVITY = 40
    const offset = ctrl.object.position.clone().sub(ctrl.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    spherical.radius = Math.max(6, Math.min(16, spherical.radius - delta * ZOOM_SENSITIVITY))
    offset.setFromSpherical(spherical)
    ctrl.object.position.copy(ctrl.target).add(offset)
    ctrl.update()
  }

  return (
    <div
      className={className}
      data-testid="puzzle-canvas"
      data-ready={ready ? "true" : "false"}
      data-camera-locked={cameraLocked ? "true" : "false"}
      data-guide-move={guideMove ?? ""}
      // Right-drag orbits the camera (OrbitControls mouseButtons.RIGHT below)
      // no matter where it starts, but the browser's native context menu
      // popping up mid-drag interrupted that -- confirmed by a user report of
      // camera rotation getting "stuck" partway through. Suppressing it here
      // is what actually makes right-drag orbit reliable.
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        camera={{ position: [5.5, 5, 6.5], fov: 40 }}
        // Phone screens report 3x and more; past 1.5 the cube looks no sharper
        // and the GPU does four times the work.
        dpr={[1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2]}
        // Draw a frame only when something changed (a turn, the camera, new
        // colours). A cube sitting still costs nothing, where it used to redraw
        // at the screen's full refresh rate for as long as the page was open.
        frameloop="demand"
        // Colours as authored: the default film-style tone curve turned white
        // stickers grey and dulled the reds.
        flat
        onCreated={({ gl }) => {
          setReady(true)
          // The browser can take the graphics context away (driver reset, too
          // many tabs). Allow it to be given back, and remount when it is.
          gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
          gl.domElement.addEventListener('webglcontextrestored', () => onContextRestored?.())
        }}
      >
        <FitToScreen />
        {/* No background colour: the canvas is see-through, and the stage behind
            it (a soft glow and a shadow on the floor) is plain CSS. */}
        {/* Stickers are paint and want even light; the Mirror Cube is metal and
            wants little of it, so its reflections do the work. */}
        <ambientLight intensity={plugin.id === 'mirror' ? 0.75 : 1.9} />
        <directionalLight position={[6, 8, 5]} intensity={plugin.id === 'mirror' ? 2.2 : 1.5} />
        <directionalLight position={[-6, -4, -5]} intensity={plugin.id === 'mirror' ? 0.7 : 0.5} />
        {plugin.id === 'mirror' && <StudioEnvironment />}
        <group scale={scale}>
          <Pieces
            plugin={plugin}
            mesh={mesh}
            state={state}
            onMove={onMove}
            interactive={interactive}
            setOrbitEnabled={setOrbitEnabled}
            gestureFeed={gestureFeed}
            previewLayer={previewLayer}
            colorblindPalette={colorblindPalette}
            colorRemap={colorRemap}
            turnMs={turnMs}
            animatingMove={animatingMove}
            onAnimationComplete={onAnimationComplete}
            onGestureOrbit={nudgeOrbit}
            onGestureZoom={nudgeZoom}
          />
          {guideMove && !animatingMove && <MoveArrow notation={guideMove} />}
        </group>
        <OrbitControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={controls as any}
          enablePan={false}
          enableRotate={!cameraLocked}
          enableZoom={!cameraLocked}
          minDistance={6}
          maxDistance={16}
          // Left orbits from empty space (pieces intercept left-drags to turn
          // a layer instead); right always orbits regardless of what's under
          // the cursor, so the camera is never stuck because a piece is there.
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        />
      </Canvas>
    </div>
  )
}

// On a tall, narrow screen the cube would overflow the sides, so zoom out in
// proportion to how narrow the canvas is.
function FitToScreen() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    Object.assign(cam, { zoom: Math.min(1, Math.max(0.55, (size.width / size.height) * 1.05)) })
    cam.updateProjectionMatrix()
  }, [camera, size])
  return null
}

let webgl: boolean | null = null
function webglAvailable(): boolean {
  if (webgl === null) {
    try {
      const probe = document.createElement('canvas')
      webgl = Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
    } catch {
      webgl = false
    }
  }
  return webgl
}

// Memoised: drawing the scene's component tree is the most expensive render in
// the app, and most of what changes on the play screen (the clock, the counters,
// the camera panel) has nothing to do with it.
export const PuzzleCanvas = memo(function PuzzleCanvas(props: PuzzleCanvasProps) {
  // Bumped when a lost graphics context comes back, to rebuild the scene on it.
  const [epoch, setEpoch] = useState(0)
  if (webglAvailable()) return <PuzzleCanvasInner key={epoch} {...props} onContextRestored={() => setEpoch((n) => n + 1)} />
  return (
    <div className={`${props.className ?? ''} grid place-items-center p-8 text-center`} data-testid="no-webgl">
      <div className="max-w-sm">
        <p className="font-display text-2xl font-bold">3D graphics are not available</p>
        <p className="mt-3 text-[#9C9AA3]">
          Your browser could not start WebGL, which draws the cube. Turn on hardware acceleration in your browser settings, or
          try a recent version of Chrome, Edge, Firefox or Safari.
        </p>
      </div>
    </div>
  )
})

// Polished metal is only silver when it has something to reflect. This paints a
// tiny studio -- a light-to-dark backdrop with a few bright panels -- onto a
// canvas and bakes it into an environment map once. (drei's <Environment> with
// light panels did the same job but blocked the page for seconds.)
function StudioEnvironment() {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const g = canvas.getContext('2d')!
    const backdrop = g.createLinearGradient(0, 0, 0, 128)
    backdrop.addColorStop(0, '#ffffff')
    backdrop.addColorStop(0.38, '#aab6d6')
    backdrop.addColorStop(0.55, '#2c3350')
    backdrop.addColorStop(1, '#05060a')
    g.fillStyle = backdrop
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#ffffff'
    g.fillRect(10, 8, 90, 34)
    g.fillRect(140, 6, 100, 30)
    g.fillStyle = '#e8eeff'
    g.fillRect(96, 50, 64, 14)
    // A dark band low on one side gives every block a shaded flank.
    g.fillStyle = '#04050a'
    g.fillRect(170, 70, 86, 40)
    const source = new THREE.CanvasTexture(canvas)
    source.mapping = THREE.EquirectangularReflectionMapping
    source.colorSpace = THREE.SRGBColorSpace
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromEquirectangular(source).texture
    Object.assign(scene, { environment: env })
    invalidate() // drawn on demand: say the reflections have arrived
    source.dispose()
    pmrem.dispose()
    return () => {
      Object.assign(scene, { environment: null })
      env.dispose()
    }
  }, [gl, scene, invalidate])
  return null
}
