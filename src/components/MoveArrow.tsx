import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { parseCubeMove } from '../core/animation/parseCubeMove'

// A curved arrow wrapped around the layer the next guided move turns,
// sweeping the way it will turn. Built from the same axis/angle the move
// animation uses (parseCubeMove), so the arrow and the actual turn can never
// disagree about direction.

const RING_RADIUS = 2.35 // just outside a 3x3 layer's corners
const ARC = Math.PI * 1.25
const COLOR = '#F5B83D'
// Asked for less motion: the arrow holds still instead of pulsing (and the
// canvas goes back to drawing only when something changes).
const STILL = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const STILL_OPACITY = 0.85

export function MoveArrow({ notation }: { notation: string }) {
  const parsed = parseCubeMove(notation)
  const materials = useRef<Array<THREE.MeshStandardMaterial | null>>([])

  const placement = useMemo(() => {
    if (!parsed) return null
    const axis = new THREE.Vector3(parsed.axis === 'x' ? 1 : 0, parsed.axis === 'y' ? 1 : 0, parsed.axis === 'z' ? 1 : 0)
    return {
      position: axis.clone().multiplyScalar(parsed.layer * 1.075),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis),
      // The arc is drawn sweeping counter-clockwise about +Z (a positive
      // rotation); mirroring it reverses the sweep for a negative one.
      mirror: parsed.angle < 0,
    }
  }, [parsed?.axis, parsed?.layer, parsed?.angle]) // eslint-disable-line react-hooks/exhaustive-deps

  // A held-still arrow still needs one frame drawn when it appears or moves.
  const { invalidate } = useThree()
  useEffect(() => invalidate(), [invalidate, notation])

  // A gentle pulse so the eye finds it.
  useFrame(({ clock, invalidate }) => {
    if (STILL) return
    const o = 0.65 + 0.3 * Math.sin(clock.elapsedTime * 4)
    for (const m of materials.current) if (m) m.opacity = o
    // The canvas draws on demand; while the arrow is up it asks for the next frame.
    invalidate()
  })

  if (!placement) return null
  const head = new THREE.Vector3(Math.cos(ARC) * RING_RADIUS, Math.sin(ARC) * RING_RADIUS, 0)

  return (
    <group position={placement.position} quaternion={placement.quaternion}>
      <group scale={[placement.mirror ? -1 : 1, 1, 1]}>
        <mesh>
          <torusGeometry args={[RING_RADIUS, 0.07, 10, 64, ARC]} />
          <meshStandardMaterial
            ref={(m) => {
              materials.current[0] = m
            }}
            color={COLOR}
            emissive={COLOR}
            emissiveIntensity={0.7}
            transparent
            opacity={STILL ? STILL_OPACITY : 1}
          />
        </mesh>
        {/* A cone points along +Y; rotating it by the arc angle about Z lines it up with the arc's tangent. */}
        <mesh position={head} rotation={[0, 0, ARC]}>
          <coneGeometry args={[0.22, 0.5, 16]} />
          <meshStandardMaterial
            ref={(m) => {
              materials.current[1] = m
            }}
            color={COLOR}
            emissive={COLOR}
            emissiveIntensity={0.7}
            transparent
            opacity={STILL ? STILL_OPACITY : 1}
          />
        </mesh>
      </group>
    </group>
  )
}
