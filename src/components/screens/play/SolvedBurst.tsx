// The moment a scrambled cube comes back solved: stickers in the cube's six
// colours scatter from the middle of the stage and are gone in a second. It is
// the one piece of motion on the play screen that is there for delight, so it
// runs once per solve and not at all for anyone who has asked for less motion
// (the reduced-motion rule in index.css collapses it to nothing).

const COLOURS = ['#F4F5F8', '#FFD500', '#E5384F', '#2F6FDE', '#FF8A00', '#2FB36B']
const PIECES = 30

// Fixed, evenly spread directions with a little variety, so the burst looks the
// same every time and needs no random numbers while rendering.
const SHARDS = Array.from({ length: PIECES }, (_, i) => {
  const angle = (i / PIECES) * Math.PI * 2 + (i % 3) * 0.21
  const reach = 150 + ((i * 53) % 130)
  return {
    colour: COLOURS[i % COLOURS.length],
    x: Math.cos(angle) * reach,
    y: Math.sin(angle) * reach * 0.8 - 30,
    spin: ((i * 97) % 360) - 180,
    size: 10 + ((i * 7) % 9),
    delay: (i % 5) * 18,
  }
})

export function SolvedBurst() {
  return (
    <div aria-hidden data-testid="solved-burst" className="pointer-events-none absolute left-1/2 top-[44%] z-20">
      {SHARDS.map((s, i) => (
        <span
          key={i}
          className="solved-shard absolute rounded-[3px]"
          style={{
            width: s.size,
            height: s.size,
            background: s.colour,
            animationDelay: `${s.delay}ms`,
            ['--x' as string]: `${s.x}px`,
            ['--y' as string]: `${s.y}px`,
            ['--spin' as string]: `${s.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
