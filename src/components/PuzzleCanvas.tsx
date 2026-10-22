import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { parseCubeMove } from '../core/animation/parseCubeMove'
import { turnLanded } from '../core/feel/turnFeel'
import { moveFromDrag, AXIS_INDEX, type Axis, type DragInput } from '../core/gestures/MouseDragAdapter'
import type { GestureFeed } from '../core/gestures/useHandGestures'
import { MoveArrow } from './MoveArrow'
import { orbitFromHand } from '../core/gestures/handOrbit'
import { pieceBox } from '../core/puzzles/mirror/geometry'
import { currentSlot, mirrorPiecesOf } from '../core/puzzles/mirror/pieces'
import { applyColorblindPaletteToColors } from '../core/puzzles/colorblindPalette'
import type { Move, PuzzleMesh, PuzzlePlugin, PuzzleState } from '../core/puzzles/PuzzlePlugin'
import { softEase, turnEase } from '../motion/easing'
import { prefersReducedMotion } from '../motion/stagger'

type Slot = [number, number, number]

// Fraction of each piece's own slot distance from centre used as its visual
// gap offset (see the render loop below) -- proportional, not a fixed unit
// count, so it looks right across cube3's ~1.5-unit half-extent and
// any other puzzle's alike. Widened from 0.045 on user feedback
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

// Pieces out of focus (not in the layer a hand sign has picked, or not among
// the lesson's pieces) sink back toward the dark plastic, keeping their hue so
// the colours can still be read. Dimming fades in and out rather than snapping.
const DIM_TOWARD = new THREE.Color('#1A1B20')
const DIM_STRENGTH = 0.58
const DIM_FADE_MS = 200

// ---- The 3x3's look: a moulded black plastic cubie with rounded edges that
// catch the light, and a thin glossy sticker with rounded corners on each outer
// face. The bodies share one geometry and one material; each sticker has its
// own material only so it can fade in and out of focus on its own.
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

// Vinyl with a faint gloss: the studio's softboxes slide across it as it turns.
const newStickerMaterial = () => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0, envMapIntensity: 0.55 })

let cubieShape: RoundedBoxGeometry | null = null
// Drawn only: the pointer still hits the plugin's own square box (see Pieces).
function cubieGeometry(): RoundedBoxGeometry {
  cubieShape ??= new RoundedBoxGeometry(1, 1, 1, 3, 0.085)
  return cubieShape
}

let cubieBody: THREE.MeshStandardMaterial | null = null
function bodyMaterial(): THREE.MeshStandardMaterial {
  // Moulded, not painted: a satin black whose rounded edges pick up the lights.
  cubieBody ??= new THREE.MeshStandardMaterial({ color: '#0E0F13', roughness: 0.42, metalness: 0, envMapIntensity: 0.9 })
  return cubieBody
}

// The Mirror Cube is brushed blue metal on a black core: blue, not grey, so it
// stands out from the black page. Each piece gets its own tile material (shared
// by its three tiles) so it can fade out of focus alone.
const MIRROR_BLUE = new THREE.Color('#8FB4FF')
let mirrorCore: THREE.MeshStandardMaterial | null = null
const mirrorBody = () => (mirrorCore ??= new THREE.MeshStandardMaterial({ color: '#14161F', roughness: 0.85 }))
const newMirrorTile = () =>
  new THREE.MeshStandardMaterial({ color: MIRROR_BLUE, map: brushedTexture(), metalness: 0.9, roughness: 0.22, envMapIntensity: 1.25 })

let brushed: THREE.CanvasTexture | null = null
// Fine light and dark streaks, all running one way: brushed metal. Mipmapped and
// filtered at an angle, so the streaks melt into a sheen at a distance instead
// of shimmering into stripes.
function brushedTexture(): THREE.CanvasTexture {
  if (brushed) return brushed
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  for (let y = 0; y < 256; y++) {
    const v = 214 + Math.floor(Math.random() * 30)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(0, y, 256, 1)
  }
  brushed = new THREE.CanvasTexture(c)
  brushed.colorSpace = THREE.SRGBColorSpace
  brushed.anisotropy = 8
  return brushed
}

interface DragStart {
  normal: [number, number, number]
  slot: Slot
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

// Once a drag reads as a turn, the layer gives a little, the way a real one
// yields under your thumb before it goes: up to this angle, growing with the
// drag. It shows which layer and which way before you let go. Released, it is
// either carried on by the turn itself or springs back.
const GIVE_MAX = 0.1 // radians, under 6 degrees
const GIVE_HOLD_MS = 160 // how long a released give waits for its turn to start

interface PiecesProps {
  plugin: PuzzlePlugin
  mesh: PuzzleMesh
  state: PuzzleState
  onMove: (move: Move | null) => void
  interactive: boolean
  setOrbitEnabled: (enabled: boolean) => void
  gestureFeed?: GestureFeed | null
  previewLayer?: { axis: Axis; layer: number } | null
  focusSlots?: Slot[] | null
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
  focusSlots,
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
  const activeAnim = useRef<{ axis: Axis; layer: -1 | 0 | 1; angle: number; from: number; startedAt: number; landed: boolean } | null>(null)
  const give = useRef<{ axis: Axis; layer: number; angle: number; target: number; releasedAt: number | null } | null>(null)

  // Where each piece is drawn and how it is turned. A 3x3 never moves its
  // meshes -- it repaints stickers -- so every piece stays at its own slot,
  // unrotated. A Mirror Cube has no stickers: its pieces' SHAPES must travel,
  // so each one is drawn at the slot and rotation its piece tracker reports.
  const isMirror = plugin.id === 'mirror'
  const poses = useMemo(() => {
    const out = new Map<string, { slot: Slot; base: THREE.Quaternion }>()
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

  // ---- Colour and focus. Every sticker (every Mirror piece's tiles) has its
  // own material, painted here rather than through React so a fade costs no
  // re-render: its colour is the face's colour, sunk toward the plastic by how
  // far out of focus the piece currently is.
  const materials = useRef(new Map<string, THREE.MeshStandardMaterial>())
  const baseColor = useRef(new Map<string, THREE.Color>())
  const dimNow = useRef(new Map<string, number>())
  const materialFor = (key: string) => {
    let m = materials.current.get(key)
    if (!m) {
      m = isMirror ? newMirrorTile() : newStickerMaterial()
      materials.current.set(key, m)
    }
    return m
  }
  useEffect(() => {
    const all = materials.current
    return () => {
      for (const m of all.values()) m.dispose()
      all.clear()
    }
  }, [])

  const paint = (pieceId: string) => {
    const amount = dimNow.current.get(pieceId) ?? 0
    const keys = isMirror ? [pieceId] : faceKeys.map((face) => `${pieceId}:${face}`)
    for (const key of keys) {
      const m = materials.current.get(key)
      const base = isMirror ? MIRROR_BLUE : baseColor.current.get(key)
      if (m && base) m.color.copy(base).lerp(DIM_TOWARD, amount * DIM_STRENGTH)
    }
  }

  const focusSet = useMemo(() => (focusSlots ? new Set(focusSlots.map((s) => s.join(','))) : null), [focusSlots])
  const dimTargetRef = useRef<(slot: Slot) => number>(() => 0)
  dimTargetRef.current = (slot) => {
    const byPreview = !activeAnim.current && previewLayer != null && slot[AXIS_INDEX[previewLayer.axis]] !== previewLayer.layer
    const byFocus = focusSet !== null && !focusSet.has(slot.join(','))
    return byPreview || byFocus ? 1 : 0
  }

  // New colours (a turn landed, a palette changed): repaint before the frame is drawn.
  useLayoutEffect(() => {
    const target = dimTargetRef.current
    for (const piece of mesh.pieces) {
      if (!isMirror) {
        const faceColors = colors.get(piece.pieceId) ?? {}
        for (const face of faceKeys) {
          const hex = faceColors[face]
          if (!hex) continue
          const key = `${piece.pieceId}:${face}`
          const c = baseColor.current.get(key) ?? new THREE.Color()
          baseColor.current.set(key, c.set(hex))
        }
      }
      // A piece seen for the first time starts where it should be, not fading into it.
      if (!dimNow.current.has(piece.pieceId)) dimNow.current.set(piece.pieceId, target(posesRef.current.get(piece.pieceId)?.slot ?? piece.slot))
      paint(piece.pieceId)
    }
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, mesh, isMirror, faceKeys, invalidate])

  // Focus changed: let the frame loop fade toward it.
  useEffect(() => {
    invalidate()
  }, [previewLayer, focusSet, poses, invalidate])

  // Moves every piece's dim one frame's worth toward where it should be;
  // true while any is still on its way.
  const fadeDims = (dtMs: number) => {
    let moving = false
    const step = prefersReducedMotion() ? 1 : dtMs / DIM_FADE_MS
    for (const piece of mesh.pieces) {
      const slot = posesRef.current.get(piece.pieceId)?.slot ?? piece.slot
      const target = dimTargetRef.current(slot)
      const now = dimNow.current.get(piece.pieceId) ?? target
      if (now === target) continue
      const next = now < target ? Math.min(target, now + step) : Math.max(target, now - step)
      dimNow.current.set(piece.pieceId, next)
      paint(piece.pieceId)
      if (next !== target) moving = true
    }
    return moving
  }

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
        invalidate()
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
    // A layer already given a little by the drag that made this turn carries
    // on from there, instead of jumping back to the start.
    const g = give.current
    const from = g && g.axis === parsed.axis && g.layer === parsed.layer && g.angle * parsed.angle > 0 ? g.angle : 0
    give.current = null
    activeAnim.current = { ...parsed, from, startedAt: performance.now(), landed: false }
    invalidate()
  }, [animatingMove, invalidate])

  const turnLayer = (axis: Axis, layer: number, angle: number) => {
    const turn = new THREE.Quaternion().setFromAxisAngle(AXIS_VECTOR[axis], angle)
    const axisIdx = AXIS_INDEX[axis]
    for (const [pieceId, group] of pieceGroupRefs.current) {
      const pose = posesRef.current.get(pieceId)
      if (!pose) continue
      if (pose.slot[axisIdx] === layer) group.quaternion.copy(turn).multiply(pose.base)
      else if (!group.quaternion.equals(pose.base)) group.quaternion.copy(pose.base)
    }
  }

  useFrame((_, delta) => {
    const now = performance.now()
    // After a rest the clock's first step is long; a fade or a give should not jump.
    const dtMs = Math.min(delta * 1000, 50)
    let more = false
    const anim = activeAnim.current
    if (anim) {
      // The canvas only draws when asked; a turn in progress asks every frame.
      more = true
      const t = Math.min(1, (now - anim.startedAt) / turnMsRef.current)
      // A spring with a real cube's detent: the layer runs a hair past the
      // quarter and settles back. Asked for less motion, it simply arrives.
      const eased = (prefersReducedMotion() ? softEase : turnEase)(t)
      // The click is felt the moment the layer first reaches its place.
      if (!anim.landed && eased >= 1) {
        anim.landed = true
        turnLanded(now)
      }
      turnLayer(anim.axis, anim.layer, anim.from + (anim.angle - anim.from) * eased)
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
    } else if (give.current) {
      const g = give.current
      if (g.releasedAt !== null && now - g.releasedAt > GIVE_HOLD_MS) g.target = 0
      g.angle += (g.target - g.angle) * (1 - Math.exp(-dtMs / 45))
      if (Math.abs(g.target - g.angle) < 1e-4) g.angle = g.target
      if (g.angle === 0 && g.target === 0) {
        give.current = null
        turnLayer(g.axis, g.layer, 0)
      } else turnLayer(g.axis, g.layer, g.angle)
      more = g.angle !== g.target || g.releasedAt !== null
    }
    if (fadeDims(dtMs)) more = true
    if (more) invalidate()
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
    const dragInput = (start: DragStart, e: PointerEvent): DragInput => ({
      hitNormal: start.normal,
      slot: start.slot,
      dragScreen: [e.clientX - start.x, e.clientY - start.y],
      axisScreenDirs: axisScreenDirs(camera),
    })
    const finish = (e: PointerEvent) => {
      const start = drag.current
      drag.current = null
      setOrbitEnabled(true)
      if (give.current) {
        give.current.releasedAt = performance.now()
        invalidate()
      }
      if (!start) return
      onMove(moveFromDrag(dragInput(start, e)))
    }
    // Feedback only: what the drag would turn if let go now. The turn itself is
    // still decided once, on release, exactly as before.
    const follow = (e: PointerEvent) => {
      const start = drag.current
      if (!start || activeAnim.current) return
      const input = dragInput(start, e)
      const move = moveFromDrag(input)
      const parsed = move ? parseCubeMove(move.alg.toString()) : null
      if (!parsed) {
        if (give.current) give.current.target = 0
      } else {
        const past = Math.hypot(...input.dragScreen) - 8
        const target = Math.sign(parsed.angle) * GIVE_MAX * (1 - Math.exp(-past / 70))
        const g = give.current
        if (g && g.axis === parsed.axis && g.layer === parsed.layer) g.target = target
        else give.current = { axis: parsed.axis, layer: parsed.layer, angle: 0, target, releasedAt: null }
      }
      invalidate()
    }
    window.addEventListener('pointermove', follow)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', follow)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [camera, onMove, setOrbitEnabled, invalidate])

  const handleDown = (e: ThreeEvent<PointerEvent>, slot: Slot, base: THREE.Quaternion = IDENTITY_QUATERNION) => {
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

  const register = (pieceId: string) => (el: THREE.Group | null) => {
    if (el) pieceGroupRefs.current.set(pieceId, el)
    else pieceGroupRefs.current.delete(pieceId)
  }

  return (
    <group>
      {mesh.pieces.map((piece) => {
        const pose = poses.get(piece.pieceId)
        if (!pose) return null
        if (isMirror) {
          const box = pieceBox(piece.slot)
          const [sx, sy, sz] = box.size
          // A black plastic body with a brushed-metal tile on every side: each
          // tile is a slab inset across its own face but standing proud along
          // its axis, so a dark rim frames every tile like a real Mirror Cube.
          const tiles: [number, number, number][] = [
            [sx - 0.03, sy - 0.16, sz - 0.16],
            [sx - 0.16, sy - 0.03, sz - 0.16],
            [sx - 0.16, sy - 0.16, sz - 0.03],
          ]
          const tile = materialFor(piece.pieceId)
          return (
            <group key={piece.pieceId} quaternion={pose.base} ref={register(piece.pieceId)}>
              <group position={box.center} onPointerDown={(e) => handleDown(e, pose.slot, pose.base)}>
                <mesh material={mirrorBody()}>
                  <boxGeometry args={[sx - 0.1, sy - 0.1, sz - 0.1]} />
                </mesh>
                {tiles.map((t, i) => (
                  <mesh key={i} material={tile}>
                    <boxGeometry args={t} />
                  </mesh>
                ))}
              </group>
            </group>
          )
        }
        const faceColors = colors.get(piece.pieceId) ?? {}
        // A solved face is one uniform colour with no gap between cubies, so
        // it renders as a single solid block and the puzzle reads as static
        // plastic rather than a twisty puzzle. Nudging each piece slightly
        // outward along its own slot direction (proportional to the puzzle's
        // own scale, not a fixed constant) reveals real seams between pieces
        // without needing any puzzle-specific axis knowledge.
        const gapOffset = piece.slot.map((v) => v * GAP_FRACTION) as Slot
        return (
          <group key={piece.pieceId} position={gapOffset} ref={register(piece.pieceId)}>
            {/* The pointer hits the plugin's square box, exactly as it always has
                (its flat faces give the drag its face normal); what is drawn is
                the rounded cubie. */}
            <mesh
              geometry={piece.geometry}
              visible={false}
              userData={{ slot: piece.slot }}
              onPointerDown={(e) => handleDown(e, piece.slot)}
            />
            <mesh geometry={cubieGeometry()} material={bodyMaterial()} position={piece.slot} raycast={NO_RAYCAST} />
            {faceKeys.map((face) => {
              const placement = STICKER_PLACEMENT[face]
              if (!faceColors[face] || !placement) return null
              return (
                <mesh
                  key={face}
                  geometry={stickerGeometry()}
                  material={materialFor(`${piece.pieceId}:${face}`)}
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
  // The layer a hand sign has selected, before it turns: everything else dims.
  previewLayer?: { axis: Axis; layer: number } | null
  // The pieces a lesson is about, by slot ([x, y, z] in -1..1; x right, y up,
  // z front): every other piece dims, fading in and out. Combines with
  // previewLayer (a piece either one dims is dimmed). Memoise the array.
  focusSlots?: Slot[] | null
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
  focusSlots = null,
  guideMove = null,
  onContextRestored,
}: PuzzleCanvasProps & { onContextRestored?: () => void }) {
  const mesh = useMemo(() => plugin.buildGeometry(), [plugin])
  const isMirror = plugin.id === 'mirror'
  // The camera is framed for cube3's ~2.6-unit half-diagonal. Pyraminx and
  // Megaminx use a unit-radius base solid, so without this they rendered at
  // barely a third of cube3's on-screen size -- confirmed by screenshot, not
  // a theoretical concern. Normalising every puzzle's overall extent to the
  // same target radius keeps one fixed camera framing working for every puzzle.
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
            it (a soft glow) is plain CSS. */}
        {/* A soft studio: a big diffuse key from above and in front, a little
            fill from the side, and the studio's softboxes reflected in the
            stickers' gloss and the plastic's edges. Metal takes almost all its
            look from the reflections, so the Mirror Cube gets less direct light. */}
        <hemisphereLight args={['#FFFFFF', '#3A3D46', isMirror ? 0.85 : 1.5]} />
        <directionalLight position={[4, 9, 6]} intensity={isMirror ? 2.1 : 1.5} />
        <directionalLight position={[-7, 2, -3]} intensity={isMirror ? 0.5 : 0.4} />
        {/* Baking the reflections costs a lot where the graphics are weak (seconds, in a browser
            with software rendering). Metal cannot do without them; a plastic cube looks nearly
            the same with a little more direct light, so only the Mirror Cube pays. */}
        {isMirror && <StudioEnvironment />}
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
            focusSlots={focusSlots}
            colorblindPalette={colorblindPalette}
            colorRemap={colorRemap}
            turnMs={turnMs}
            animatingMove={animatingMove}
            onAnimationComplete={onAnimationComplete}
            onGestureOrbit={nudgeOrbit}
            onGestureZoom={nudgeZoom}
          />
          <ContactShadow mirror={isMirror} />
          {guideMove && !animatingMove && <MoveArrow notation={guideMove} reach={isMirror ? 2.05 : 1.7} />}
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

// The camera is framed by height, with a little room left round the cube for
// the guide's arrow. On a canvas narrower than it is tall the cube would crowd
// the sides, so zoom out in proportion to how narrow the canvas is.
function FitToScreen() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    Object.assign(cam, { zoom: Math.min(0.94, Math.max(0.42, (size.width / size.height) * 0.86)) })
    cam.updateProjectionMatrix()
  }, [camera, size])
  return null
}

// Where the cube's shadow falls on the table below it: a dark core right under
// it and a soft penumbra, painted once into a small texture. It is part of the
// scene, so it stays under the cube when the view turns and is hidden from below.
let shadowTexture: THREE.CanvasTexture | null = null
function shadowMap(): THREE.CanvasTexture {
  if (!shadowTexture) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, 'rgba(0,0,0,0.62)')
    r.addColorStop(0.35, 'rgba(0,0,0,0.42)')
    r.addColorStop(0.7, 'rgba(0,0,0,0.12)')
    r.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 128, 128)
    shadowTexture = new THREE.CanvasTexture(c)
  }
  return shadowTexture
}
function ContactShadow({ mirror }: { mirror: boolean }) {
  // Low enough that a corner swinging down mid-turn never dips into it. The
  // Mirror Cube's block sits off-centre, a little to the right and front.
  const at: Slot = mirror ? [0.2, -2.25, 0.1] : [0, -2.25, 0]
  return (
    <mesh position={at} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST} renderOrder={-1}>
      <planeGeometry args={[5.2, 5.2]} />
      <meshBasicMaterial map={shadowMap()} transparent depthWrite={false} />
    </mesh>
  )
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
  return <NoWebGL {...props} />
})

function NoWebGL({ className, animatingMove, onAnimationComplete }: PuzzleCanvasProps) {
  // There is no picture of the turn to wait for: report each one done at once,
  // so the move queue (and Scramble, Solve, the guide) carries on at full speed.
  useEffect(() => {
    if (animatingMove) onAnimationComplete?.()
  }, [animatingMove, onAnimationComplete])
  return (
    <div className={`${className ?? ''} grid place-items-center p-8 text-center`} data-testid="no-webgl">
      <div className="max-w-sm">
        <p className="font-display text-2xl font-bold">3D graphics are not available</p>
        <p className="mt-3 text-fg-faint">
          Your browser could not start WebGL, which draws the cube. Turn on hardware acceleration in your browser settings, or
          try a recent version of Chrome, Edge, Firefox or Safari.
        </p>
      </div>
    </div>
  )
}

// What the gloss and the metal reflect: a tiny studio -- a dark room, a large
// softbox overhead and in front, a strip light to one side, a dim warm bounce
// from the table -- painted onto a canvas and baked into an environment map
// once. (drei's <Environment> with light panels did the same job but blocked
// the page for seconds.)
function StudioEnvironment() {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const g = canvas.getContext('2d')!
    const room = g.createLinearGradient(0, 0, 0, 128)
    room.addColorStop(0, '#3a3f4c')
    room.addColorStop(0.45, '#20232b')
    room.addColorStop(0.55, '#14161b')
    room.addColorStop(1, '#0a0b0e')
    g.fillStyle = room
    g.fillRect(0, 0, 256, 128)
    // The key softbox: soft-edged, overhead and toward the viewer.
    const key = g.createRadialGradient(160, 22, 4, 160, 22, 46)
    key.addColorStop(0, '#ffffff')
    key.addColorStop(0.55, '#f2f4f8')
    key.addColorStop(1, 'rgba(242,244,248,0)')
    g.fillStyle = key
    g.fillRect(100, 0, 120, 70)
    // A tall strip light on one side, for a crisp edge highlight.
    g.fillStyle = '#d8deea'
    g.fillRect(34, 26, 14, 46)
    // The table's warm bounce.
    g.fillStyle = 'rgba(120,96,70,0.35)'
    g.fillRect(0, 96, 256, 32)
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
