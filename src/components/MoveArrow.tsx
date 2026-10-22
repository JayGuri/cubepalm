import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { parseCubeMove } from '../core/animation/parseCubeMove'
import { prefersReducedMotion } from '../motion/stagger'

// The guide's arrow: a gold band wrapped round the layer the next move turns,
// lying just proud of that layer's stickers, the way a tutorial draws it on the
// cube, with its head where the layer is going. Built from the same axis and
// angle the turn itself uses (parseCubeMove), so the two can never disagree.
//
// It always wraps the corner nearest the camera, so its head is on a face you
// can see however the cube is held; it glides round when the view changes. A
// half turn gets a second head halfway along. A gleam runs from tail to head
// now and then to show the way it goes, and holds still if motion is reduced.

const GOLD = '#F5B83D'
const OUTLINE = '#101115'
const LAYER_DEPTH = 1.075 // a layer's middle, from the cube's centre
const CORNER = 0.5 // corner radius of the band's path
const TUBE = 0.055
const RIM = 0.03 // the dark outline round the gold, so it reads on yellow and white stickers too
const SPAN = 0.3 // share of the way round a layer that a quarter turn's arrow covers
const SPAN_HALF = 0.44
const GLEAM_MS = 1100 // a gleam runs this long...
const REST_MS = 1300 // ...then the canvas rests, and draws nothing, for this long
const FADE_IN_MS = 180

/** One point along a rounded square of half-size `h`, counter-clockwise from the middle of its +x side. */
function roundedSquare(h: number): THREE.Path {
  const s = h - CORNER
  const p = new THREE.Path()
  p.moveTo(h, 0)
  p.lineTo(h, s)
  p.absarc(s, s, CORNER, 0, Math.PI / 2, false)
  p.lineTo(-s, h)
  p.absarc(-s, s, CORNER, Math.PI / 2, Math.PI, false)
  p.lineTo(-h, -s)
  p.absarc(-s, -s, CORNER, Math.PI, Math.PI * 1.5, false)
  p.lineTo(s, -h)
  p.absarc(s, -s, CORNER, Math.PI * 1.5, Math.PI * 2, false)
  p.lineTo(h, 0)
  return p
}

/** Part of the rounded square, centred on its +x+y corner, as a 3D curve in the z = 0 plane. */
class Band extends THREE.Curve<THREE.Vector3> {
  private path: THREE.Path
  private from: number
  private span: number
  constructor(h: number, span: number) {
    super()
    this.path = roundedSquare(h)
    this.from = 0.125 - span / 2 // the +x+y corner is an eighth of the way round
    this.span = span
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const u = (this.from + this.span * t + 1) % 1
    const p = this.path.getPointAt(u)
    return target.set(p.x, p.y, 0)
  }
}

// Gold along the band, alpha rising from a faded tail.
function withTail(geometry: THREE.TubeGeometry): THREE.TubeGeometry {
  const uv = geometry.getAttribute('uv')
  const colors = new Float32Array(uv.count * 4)
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i)
    const a = Math.min(1, u / 0.3)
    colors.set([1, 1, 1, a * a * (3 - 2 * a)], i * 4)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
  return geometry
}

let gleam: THREE.DataTexture | null = null
function gleamTexture(): THREE.DataTexture {
  if (gleam) return gleam
  const n = 64
  const data = new Uint8Array(n * 4)
  for (let i = 0; i < n; i++) {
    const d = Math.abs(i / n - 0.5) / 0.1 // a soft band a fifth of the texture wide
    const v = Math.round(255 * (0.55 + 0.45 * Math.max(0, 1 - d * d)))
    data.set([v, v, v, 255], i * 4)
  }
  // Clamped, not repeated: a band moved past either end is simply gone.
  gleam = new THREE.DataTexture(data, n, 1)
  gleam.magFilter = THREE.LinearFilter
  gleam.needsUpdate = true
  return gleam
}

const AXIS: Record<'x' | 'y' | 'z', THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
}
const Z = new THREE.Vector3(0, 0, 1)
const v = new THREE.Vector3()

/** `reach`: half the width of the band's path, just outside the layer's widest pieces. */
export function MoveArrow({ notation, reach = 1.7 }: { notation: string; reach?: number }) {
  const parsed = parseCubeMove(notation)
  const axis = parsed?.axis
  const layer = parsed?.layer ?? 0
  const half = Math.abs(parsed?.angle ?? 0) > Math.PI * 0.75
  const mirror = (parsed?.angle ?? 0) < 0
  const { invalidate, camera } = useThree()
  const spin = useRef<THREE.Group>(null)
  const frame = useRef<THREE.Group>(null)
  const still = prefersReducedMotion()

  const parts = useMemo(() => {
    const band = new Band(reach, half ? SPAN_HALF : SPAN)
    const head = (t: number) => {
      const at = band.getPoint(t)
      const dir = band.getTangent(Math.min(t, 0.999)).normalize()
      return { at, quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir) }
    }
    return {
      tube: withTail(new THREE.TubeGeometry(band, 96, TUBE, 10, false)),
      rim: withTail(new THREE.TubeGeometry(band, 96, TUBE + RIM, 10, false)),
      cone: new THREE.ConeGeometry(0.15, 0.36, 18).translate(0, 0.1, 0),
      coneRim: new THREE.ConeGeometry(0.15 + RIM * 1.4, 0.36 + RIM * 2.6, 18).translate(0, 0.1, 0),
      heads: half ? [head(0.5), head(1)] : [head(1)],
    }
  }, [reach, half])
  useEffect(
    () => () => {
      parts.tube.dispose()
      parts.rim.dispose()
      parts.cone.dispose()
      parts.coneRim.dispose()
    },
    [parts],
  )

  // Imperative three.js state, mutated every frame (opacity, the gleam's
  // offset) -- a ref, like the mesh refs above, not render output.
  const materialsRef = useRef<{
    gold: THREE.MeshStandardMaterial
    headGold: THREE.MeshStandardMaterial
    rim: THREE.MeshBasicMaterial
    headRim: THREE.MeshBasicMaterial
    all: THREE.Material[]
  } | null>(null)
  const materials = (materialsRef.current ??= (() => {
    const gold = new THREE.MeshStandardMaterial({
      color: GOLD,
      emissive: GOLD,
      emissiveIntensity: still ? 0.6 : 0.85,
      emissiveMap: still ? null : gleamTexture().clone(),
      roughness: 0.35,
      metalness: 0,
      vertexColors: true,
      transparent: true,
    })
    const headGold = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.6, roughness: 0.35, transparent: true })
    const rim = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide, vertexColors: true, transparent: true })
    const headRim = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide, transparent: true })
    return { gold, headGold, rim, headRim, all: [gold, headGold, rim, headRim] }
  })())
  useEffect(() => {
    const m = materialsRef.current
    return () => {
      if (!m) return
      m.gold.emissiveMap?.dispose()
      for (const mat of m.all) mat.dispose()
      materialsRef.current = null
    }
  }, [])

  const shownAt = useRef(0)
  const angle = useRef<number | null>(null)
  const wake = useRef<number | undefined>(undefined)
  useEffect(() => {
    shownAt.current = performance.now()
    invalidate()
  }, [notation, invalidate])
  useEffect(() => () => window.clearTimeout(wake.current), [])

  useFrame(() => {
    const group = frame.current
    const inner = spin.current
    if (!group || !inner) return
    const now = performance.now()
    let more = false

    // Which corner of the layer faces the camera, in the band's own plane.
    group.updateWorldMatrix(true, false)
    v.copy(camera.position)
    group.worldToLocal(v)
    const facing = Math.atan2(v.y, mirror ? -v.x : v.x)
    const target = Math.round((facing - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2)
    if (angle.current === null || still) angle.current = target
    else {
      let d = target - angle.current
      d = Math.atan2(Math.sin(d), Math.cos(d))
      angle.current = Math.abs(d) < 0.002 ? target : angle.current + d * 0.18
      more ||= angle.current !== target
    }
    inner.rotation.z = angle.current

    const age = now - shownAt.current
    const opacity = still ? 0.95 : Math.min(1, age / FADE_IN_MS)
    for (const m of materials.all) m.opacity = opacity
    more ||= opacity < 1

    const map = materials.gold.emissiveMap
    if (map) {
      const period = GLEAM_MS + REST_MS
      const phase = (age % period) / GLEAM_MS
      // The band of light enters at the tail and leaves past the head; between runs, it waits off the end.
      map.offset.x = phase < 1 ? 0.5 - (-0.25 + 1.5 * phase) : -0.85
      if (phase < 1) more = true
      else {
        window.clearTimeout(wake.current)
        wake.current = window.setTimeout(() => invalidate(), period - (age % period))
      }
    }
    if (more) invalidate()
  })

  if (!axis) return null
  const quaternion = new THREE.Quaternion().setFromUnitVectors(Z, AXIS[axis])
  return (
    <group ref={frame} position={AXIS[axis].clone().multiplyScalar(layer * LAYER_DEPTH)} quaternion={quaternion}>
      <group scale={[mirror ? -1 : 1, 1, 1]}>
        <group ref={spin}>
          <mesh geometry={parts.rim} material={materials.rim} renderOrder={1} raycast={() => null} />
          <mesh geometry={parts.tube} material={materials.gold} renderOrder={2} raycast={() => null} />
          {parts.heads.map((h, i) => (
            <group key={i} position={h.at} quaternion={h.quaternion}>
              <mesh geometry={parts.coneRim} material={materials.headRim} renderOrder={1} raycast={() => null} />
              <mesh geometry={parts.cone} material={materials.headGold} renderOrder={2} raycast={() => null} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}
