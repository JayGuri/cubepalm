import { beforeAll, it } from 'vitest'
import { initCube3Logic } from '../../puzzles/cube3/logic'
import { STAGE_ORDER } from '../stages'
import { HOME_NAMES, quarterTurns } from './cube'
import { randomCube } from './practice'
import { teachCube } from './teach'

beforeAll(initCube3Logic)

it('numbers', () => {
  let seed = 99
  const below = (n: number) => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 2 ** 32) * n)
  }
  const all: [number, number, number][] = []
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if ([x, y, z].filter((v) => v).length >= 2) all.push([x, y, z])
  const per: Record<string, number[]> = {}
  const steps: number[] = []
  const total: number[] = []
  const qt: number[] = []
  const times: number[] = []
  for (let i = 0; i < 2000; i++) {
    const cube = randomCube(all, all, below)
    const t0 = performance.now()
    const s = teachCube(cube, HOME_NAMES)
    times.push(performance.now() - t0)
    for (const g of STAGE_ORDER) (per[g] ??= []).push(s.filter((x) => x.stage === g).flatMap((x) => x.moves).length)
    steps.push(s.length)
    total.push(s.flatMap((x) => x.moves).length)
    qt.push(quarterTurns(s.flatMap((x) => x.moves)))
  }
  const med = (a: number[]) => a.toSorted((p, q) => p - q)[a.length >> 1]
  const max = (a: number[]) => Math.max(...a)
  for (const g of STAGE_ORDER) console.log(g, 'median face turns', med(per[g]), 'max', max(per[g]))
  console.log('total face turns median', med(total), 'max', max(total), 'quarter turns median', med(qt), 'steps median', med(steps), 'max', max(steps))
  console.log('ms per solve median', med(times).toFixed(2), 'p95', times.toSorted((a, b) => a - b)[1900].toFixed(2), 'max', max(times).toFixed(2))
})
