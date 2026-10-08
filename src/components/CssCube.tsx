import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { parseCubeMove } from '../core/animation/parseCubeMove'
import { pieceBox } from '../core/puzzles/mirror/dimensions'
import { applyMoveToPieces, createPieces, currentSlot, type Mat3, type TrackedPiece, type Vec3 } from '../core/puzzles/mirror/pieces'

// A real, turning cube made of 26 CSS-3D cubies -- no WebGL, so it costs
// almost nothing to load. Every layer turn is animated, and the cubies are
// followed with the same rotation-matrix tracker the Mirror Cube uses, so
// stickers stay on the piece they belong to.

export type FaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'
export type LayerLetter = FaceLetter | 'M' | 'E' | 'S'

export interface CssCubeHandle {
  /** Turn a layer ("R", "U'", "F2"). Turns queue up and play one after another. */
  turn: (move: string) => Promise<void>
  /** Dim everything except one layer, or pass null to clear. */
  highlight: (layer: LayerLetter | null) => void
}

// Each cubie's six faces in CSS space (y points down): transform, the outward
// direction in cube space, and the sticker colour.
const SIDES: { t: string; n: Vec3; color: string }[] = [
  { t: 'translateZ(var(--hs))', n: [0, 0, 1], color: '#2FB36B' },
  { t: 'rotateY(180deg) translateZ(var(--hs))', n: [0, 0, -1], color: '#2F6FDE' },
  { t: 'rotateY(90deg) translateZ(var(--hs))', n: [1, 0, 0], color: '#E5384F' },
  { t: 'rotateY(-90deg) translateZ(var(--hs))', n: [-1, 0, 0], color: '#FF8A00' },
  { t: 'rotateX(90deg) translateZ(var(--hs))', n: [0, 1, 0], color: '#FFFFFF' },
  { t: 'rotateX(-90deg) translateZ(var(--hs))', n: [0, -1, 0], color: '#FFD500' },
]

const HOMES = createPieces()
const FACE_LAYER: Record<LayerLetter, { axis: number; layer: number }> = {
  M: { axis: 0, layer: 0 },
  E: { axis: 1, layer: 0 },
  S: { axis: 2, layer: 0 },
  R: { axis: 0, layer: 1 },
  L: { axis: 0, layer: -1 },
  U: { axis: 1, layer: 1 },
  D: { axis: 1, layer: -1 },
  F: { axis: 2, layer: 1 },
  B: { axis: 2, layer: -1 },
}
const FACES: FaceLetter[] = ['R', 'L', 'U', 'D', 'F', 'B']

function axisRot(axis: number, a: number): Mat3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  if (axis === 0) return [[1, 0, 0], [0, c, -s], [0, s, c]]
  if (axis === 1) return [[c, 0, s], [0, 1, 0], [-s, 0, c]]
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]]
}
const mul = (a: Mat3, b: Mat3) =>
  a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j])) as Mat3

// Cube space is y-up and CSS is y-down: flip y on both sides, write the matrix
// column by column for matrix3d, then move the cubie out to its home.
function cubieTransform(m: Mat3, at: Vec3, size: number): string {
  const f = [1, -1, 1]
  const c = (i: number, j: number) => f[i] * f[j] * m[i][j]
  return (
    `matrix3d(${c(0, 0)},${c(1, 0)},${c(2, 0)},0,${c(0, 1)},${c(1, 1)},${c(2, 1)},0,${c(0, 2)},${c(1, 2)},${c(2, 2)},0,0,0,0,1) ` +
    `translate3d(${at[0] * size}px,${-at[1] * size}px,${at[2] * size}px)`
  )
}

const invert = (m: string) => (m.endsWith("'") ? m[0] : m + "'")
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
// A different scramble every time, of a different length every time.
const randomScramble = () => {
  const out: string[] = []
  const length = Math.round(between(12, 15))
  while (out.length < length) {
    const f = FACES[Math.floor(Math.random() * 6)]
    if (out.length && out[out.length - 1][0] === f) continue
    out.push(Math.random() < 0.5 ? f : f + "'")
  }
  return out
}

interface Props {
  /** Edge length of one cubie in pixels. */
  cubie?: number
  /** Scramble itself and solve back, forever. */
  autoplay?: boolean
  /** Spin slowly on its own. */
  tumble?: boolean
  /** Lean toward the pointer. */
  followPointer?: boolean
  /** "mirror" draws the Mirror Cube: one colour, every block a different size. */
  variant?: 'standard' | 'mirror'
  className?: string
  ref?: Ref<CssCubeHandle>
}

export function CssCube({ cubie = 66, autoplay = false, tumble = false, followPointer = false, variant = 'standard', className = '', ref }: Props) {
  const mirror = variant === 'mirror'
  // Where each piece's centre sits when home: a grid cell, or its own block's centre.
  const centres = useRef<Vec3[]>(HOMES.map((p) => (mirror ? pieceBox(p.home).center : p.home)))
  // Each cube tumbles at its own pace and starts at its own point in the loop.
  const [tumbleStyle] = useState(() => ({ animationDuration: '24s', animationDelay: `-${between(0, 24).toFixed(1)}s` }))
  const els = useRef<(HTMLDivElement | null)[]>([])
  const pieces = useRef<TrackedPiece[]>(createPieces())
  const queue = useRef<Promise<void>>(Promise.resolve())
  const alive = useRef(true)
  const raf = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  // Off screen, a cube neither turns nor tumbles: nobody is watching it.
  const visible = useRef(true)

  const draw = (turn?: { axis: number; layer: number; angle: number }) => {
    pieces.current.forEach((p, i) => {
      const el = els.current[i]
      if (!el) return
      let m = p.rotation
      if (turn && currentSlot(p)[turn.axis] === turn.layer) m = mul(axisRot(turn.axis, turn.angle), m)
      el.style.transform = cubieTransform(m, centres.current[i], cubie)
    })
  }

  const animate = (move: string, ms: number) =>
    new Promise<void>((resolve) => {
      const t = parseCubeMove(move)
      if (!t || !alive.current) return resolve()
      const axis = { x: 0, y: 1, z: 2 }[t.axis]
      const start = performance.now()
      const step = (now: number) => {
        if (!alive.current) return resolve()
        const k = Math.min(1, (now - start) / ms)
        const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
        if (k < 1) {
          draw({ axis, layer: t.layer, angle: t.angle * ease })
          raf.current = requestAnimationFrame(step)
        } else {
          pieces.current = applyMoveToPieces(pieces.current, move)
          draw()
          resolve()
        }
      }
      raf.current = requestAnimationFrame(step)
    })

  useImperativeHandle(ref, () => ({
    turn: (move) => (queue.current = queue.current.then(() => animate(move, 300))),
    highlight: (letter) => {
      pieces.current.forEach((p, i) => {
        const el = els.current[i]
        if (!el) return
        const f = letter && FACE_LAYER[letter]
        el.dataset.dim = f && currentSlot(p)[f.axis] !== f.layer ? '1' : '0'
      })
    },
  }))

  useEffect(() => {
    alive.current = true
    draw()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let timer = 0
    const wait = (ms: number) => new Promise<void>((r) => (timer = window.setTimeout(r, ms)))
    const untilVisible = async () => {
      while (alive.current && !visible.current) await wait(400)
    }
    if (autoplay && !reduced) {
      void (async () => {
        // Random pauses and speeds, so two cubes on one page never move in step.
        await wait(between(300, 2200))
        while (alive.current) {
          const scramble = randomScramble()
          const pace = 270
          for (const m of scramble) {
            await untilVisible()
            if (alive.current) await animate(m, pace)
          }
          await wait(between(900, 1500))
          for (const m of [...scramble].reverse()) {
            await untilVisible()
            if (alive.current) await animate(invert(m), pace)
          }
          await wait(between(1800, 2800))
        }
      })()
    }
    return () => {
      alive.current = false
      cancelAnimationFrame(raf.current)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting
      stage.dataset.paused = entry.isIntersecting ? '0' : '1'
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // Leaning toward the pointer is written straight to the element, once a
  // frame at most. As React state it re-rendered all 150-odd elements of the
  // cube on every mouse movement.
  useEffect(() => {
    if (!followPointer) return
    let frame = 0
    let x = 0
    let y = 0
    const move = (e: PointerEvent) => {
      x = (e.clientY / window.innerHeight - 0.5) * -24
      y = (e.clientX / window.innerWidth - 0.5) * 30
      if (frame || !visible.current) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (tiltRef.current) tiltRef.current.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(frame)
    }
  }, [followPointer])

  return (
    <div aria-hidden ref={stageRef} className={`cc-stage ${className}`}>
      <div ref={tiltRef} className="transition-transform duration-500 ease-out" style={{ transformStyle: 'preserve-3d' }}>
        <div
          className={`cc-cube ${tumble ? 'cc-tumble' : ''}`}
          style={{ ['--hs' as string]: `${cubie / 2}px`, ['--c' as string]: `${cubie}px`, ...(tumble ? tumbleStyle : {}) }}
        >
          {mirror &&
            HOMES.map((p, i) => {
              // A block: six plates sized to this piece, centred on the piece.
              const [w, h, d] = pieceBox(p.home).size.map((v) => v * cubie)
              const plates = [
                { w, h, t: `translateZ(${d / 2}px)` },
                { w, h, t: `rotateY(180deg) translateZ(${d / 2}px)` },
                { w: d, h, t: `rotateY(90deg) translateZ(${w / 2}px)` },
                { w: d, h, t: `rotateY(-90deg) translateZ(${w / 2}px)` },
                { w, h: d, t: `rotateX(90deg) translateZ(${h / 2}px)` },
                { w, h: d, t: `rotateX(-90deg) translateZ(${h / 2}px)` },
              ]
              return (
                <div key={i} className="cc-block" ref={(el) => void (els.current[i] = el)}>
                  {plates.map((plate, j) => (
                    <div
                      key={j}
                      className="cc-plate"
                      style={{ width: plate.w, height: plate.h, left: -plate.w / 2, top: -plate.h / 2, transform: plate.t }}
                    />
                  ))}
                </div>
              )
            })}
          {!mirror &&
            HOMES.map((p, i) => (
            <div key={i} data-dim="0" className="cc-cubie" ref={(el) => void (els.current[i] = el)}>
              {SIDES.map((s, j) => {
                const outward = s.n.every((v, k) => v === 0 || v === p.home[k])
                return (
                  <div key={j} className="cc-sticker" style={{ transform: s.t }}>
                    {outward && <span style={{ background: s.color }} />}
                  </div>
                )
              })}
            </div>
            ))}
        </div>
      </div>
    </div>
  )
}
