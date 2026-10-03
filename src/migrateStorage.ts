// The app was called Palmtwist before it was CubePalm. Anything saved on this
// device under the old name (settings, lesson progress, best times) is carried
// over once, so the rename costs nobody their progress.
try {
  for (const key of ['settings.v1', 'academy.v1', 'best.v1', 'tips.v1', 'recentScrambles.v1']) {
    const old = localStorage.getItem(`palmtwist.${key}`)
    if (old === null) continue
    if (localStorage.getItem(`cubepalm.${key}`) === null) localStorage.setItem(`cubepalm.${key}`, old)
    localStorage.removeItem(`palmtwist.${key}`)
  }
} catch {
  // Storage blocked: there is nothing to carry over.
}
