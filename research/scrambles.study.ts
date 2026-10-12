import { it } from 'vitest'
import { randomCubie, randomScramble } from '../src/core/solvers/twoPhase'
import { round, seeded, table, writeReport } from './report'

// Is a scramble really a uniformly random cube? Two questions, kept apart:
//   1. the state generator (randomCubie), tested with a seeded source so the
//      result can be reproduced exactly;
//   2. the scrambles the app hands out (randomScramble), which use the
//      cryptographic source and so are an observed sample, different each run.

const SEED = 20261011
const STATES = 600_000 // the rarest outcome tested (1 in 12) is expected 50,000 times
const SCRAMBLES = 200 // each takes a quarter of a second of search

// 99.9th percentiles of the chi-square distribution, by degrees of freedom.
const CRITICAL: Record<number, number> = { 1: 10.828, 2: 13.816, 7: 24.322, 11: 31.264 }

const parity = (p: number[]) => {
  let n = 0
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) n++
  return n % 2
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b)
const median = (xs: number[]) => {
  const s = sorted(xs)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const factorial = (n: number): bigint => (n <= 1 ? 1n : BigInt(n) * factorial(n - 1))

/** Pearson's statistic against "every outcome equally likely". */
const chiSquare = (counts: number[]) => {
  const expected = sum(counts) / counts.length
  return sum(counts.map((c) => (c - expected) ** 2 / expected))
}

function histogram(values: number[], label: string): string {
  const rows: number[][] = []
  for (let v = Math.min(...values); v <= Math.max(...values); v++) rows.push([v, values.filter((x) => x === v).length])
  return table([label, 'scrambles'], rows)
}

it('scrambles', () => {
  // ---- 1. The state generator, seeded ------------------------------------
  const random = seeded(SEED)
  // floor(u * n) favours some values by about n / 2^32: far below what a
  // sample of this size could detect, so it stands in for a uniform source.
  const below = (n: number) => Math.floor(random() * n)

  const zeros = (n: number) => new Array<number>(n).fill(0)
  const counts: Record<string, number[]> = {
    'corner in slot 0': zeros(8),
    'edge in slot 0': zeros(12),
    'twist of corner 0': zeros(3),
    'flip of edge 0': zeros(2),
    'permutation parity': zeros(2),
    'twist of corner 7 (computed, not drawn)': zeros(3),
    'flip of edge 11 (computed, not drawn)': zeros(2),
    'edge in slot 10 (swapped by the parity fix)': zeros(12),
    'edge in slot 11 (swapped by the parity fix)': zeros(12),
  }
  let unreachable = 0
  for (let i = 0; i < STATES; i++) {
    const c = randomCubie(below)
    const validPerms = sorted(c.cp).every((v, k) => v === k) && sorted(c.ep).every((v, k) => v === k)
    if (!validPerms || sum(c.co) % 3 !== 0 || sum(c.eo) % 2 !== 0 || parity(c.cp) !== parity(c.ep)) unreachable++
    counts['corner in slot 0'][c.cp[0]]++
    counts['edge in slot 0'][c.ep[0]]++
    counts['twist of corner 0'][c.co[0]]++
    counts['flip of edge 0'][c.eo[0]]++
    counts['permutation parity'][parity(c.cp)]++
    counts['twist of corner 7 (computed, not drawn)'][c.co[7]]++
    counts['flip of edge 11 (computed, not drawn)'][c.eo[11]]++
    counts['edge in slot 10 (swapped by the parity fix)'][c.ep[10]]++
    counts['edge in slot 11 (swapped by the parity fix)'][c.ep[11]]++
  }
  const tests = Object.entries(counts).map(([name, seen]) => {
    const statistic = chiSquare(seen)
    const critical = CRITICAL[seen.length - 1]
    return [name, seen.length, seen.length - 1, round(statistic, 3), critical, statistic < critical ? 'consistent with uniform' : 'REJECTED']
  })
  const spread = Object.entries(counts).map(([name, seen]) => [name, STATES / seen.length, Math.min(...seen), Math.max(...seen)])

  // ---- 2. How many states there are, counted the way they are drawn -------
  // 8! corner orders, 12!/2 edge orders of matching parity, 3^7 free twists,
  // 2^11 free flips. BigInt, because the answer does not fit in a double.
  const stateCount = (factorial(8) * factorial(12) * 3n ** 7n * 2n ** 11n) / 2n

  // ---- 3. Real scrambles, unseeded -----------------------------------------
  const faceTurns: number[] = []
  const quarterTurns: number[] = []
  for (let i = 0; i < SCRAMBLES; i++) {
    const moves = randomScramble().split(' ')
    faceTurns.push(moves.length)
    quarterTurns.push(sum(moves.map((m) => (m.includes('2') ? 2 : 1))))
  }
  const summarise = (name: string, xs: number[]) => [name, round(sum(xs) / xs.length), median(xs), Math.min(...xs), Math.max(...xs)]

  writeReport({
    name: 'scrambles',
    title: 'Are scrambles uniformly random cubes?',
    summary:
      'The app scrambles by drawing a random cube state (`randomCubie` in `src/core/solvers/twoPhase.ts`), solving it and playing the solution backwards. ' +
      'This report tests the state generator for uniformity with chi-square goodness-of-fit tests, checks that it only produces reachable cubes, ' +
      'and describes the length of the scrambles the app actually hands out. The proof that the construction is uniform is in `docs/MATH.md`; ' +
      'this is the empirical check that the code matches the proof.',
    parameters: {
      seed: SEED,
      'states drawn (seeded)': STATES,
      'scrambles drawn (cryptographic source, not seeded)': SCRAMBLES,
      'significance level per test': '0.1% (99.9th percentile critical values)',
      runtime: `Node ${process.version}`,
    },
    sections: [
      {
        heading: 'Reachability',
        body:
          `Of ${STATES} generated states, ${unreachable} broke a reachability rule ` +
          '(both arrangements valid permutations, corner twists summing to 0 mod 3, edge flips summing to 0 mod 2, corner and edge permutation parities equal).\n\n' +
          `Counting the states the way the generator draws them, 8! x (12! / 2) x 3^7 x 2^11 = ${stateCount.toLocaleString('en-US')}.`,
      },
      {
        heading: 'Chi-square tests of uniformity',
        body:
          'Each row counts one feature over all the states and compares the counts with "every outcome equally likely". ' +
          'A statistic below the critical value means the counts are within what chance allows at the 0.1% level. ' +
          'The last four rows are where a subtle bias would hide: the twist and flip that are computed from the others rather than drawn, ' +
          'and the two edge slots that the parity fix swaps.\n\n' +
          table(['feature', 'outcomes', 'degrees of freedom', 'chi-square', 'critical value (99.9%)', 'verdict'], tests) +
          '\n\nThe counts behind the statistics:\n\n' +
          table(['feature', 'expected per outcome', 'lowest count', 'highest count'], spread),
      },
      {
        heading: 'Length of real scrambles',
        body:
          `An observed sample of ${SCRAMBLES} calls to \`randomScramble()\`. It uses the browser-grade cryptographic generator, which cannot be seeded, ` +
          'so these figures change a little from run to run. A scramble is the inverse of a two-phase solution found in a quarter of a second, ' +
          'so its length is the length of that solution, not the shortest possible; and the generator redraws any cube whose solution has fewer than 16 face turns.\n\n' +
          table(['unit', 'mean', 'median', 'min', 'max'], [summarise('face turns', faceTurns), summarise('quarter turns (a half turn counts 2)', quarterTurns)]) +
          '\n\n' +
          histogram(faceTurns, 'face turns') +
          '\n\n' +
          histogram(quarterTurns, 'quarter turns'),
      },
      {
        heading: 'What this does and does not show',
        body: [
          '- It shows that nine one-dimensional features of the generated states are consistent with uniformity, and that no generated state was unreachable. With nine tests at the 0.1% level, a perfectly uniform generator would still fail at least one of them in up to ' +
            `${round(tests.length * 0.1, 1)}% of seeds.`,
          '- A chi-square test cannot prove uniformity over every reachable state: no sample can. It can only fail to find a bias in the features it looks at. The argument that there is none is the proof in `docs/MATH.md`.',
          '- The tests use a seeded generator in place of the cryptographic one, so they test the construction (shuffle, parity fix, computed last twist and flip), not the quality of `crypto.getRandomValues`.',
          '- The scramble-length figures describe this solver at this time budget on one machine (Node, one thread); a faster machine finds slightly shorter solutions in the same time.',
        ].join('\n'),
      },
    ],
  })
})
