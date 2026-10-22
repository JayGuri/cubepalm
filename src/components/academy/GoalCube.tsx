import { memo } from 'react'
import type { Ref } from 'react'
import { CssCube, type CssCubeHandle } from '../CssCube'
import { academyColour, lessonColour, lessonView } from './colours'

// The Academy's small cubes, in its colours (see colours.ts).

/** A still picture of what a lesson makes. */
export const GoalCube = memo(function GoalCube({ lessonId, cubie = 13 }: { lessonId: string; cubie?: number }) {
  return <CssCube cubie={cubie} view={lessonView(lessonId)} stickerColour={lessonColour(lessonId)} />
})

/** A cube in the Academy's colours, for demos. */
export function AcademyCube(props: { cubie: number; setup?: string; pace?: number; lessonId?: string; view?: { x: number; y: number }; ref?: Ref<CssCubeHandle> }) {
  const { lessonId, ...rest } = props
  return <CssCube {...rest} stickerColour={lessonId ? lessonColour(lessonId) : (_h, _n, c) => academyColour(c)} />
}
