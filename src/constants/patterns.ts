export type PatternOption = {
  id: string
  name: string
  file: string | null
  isUpload?: boolean
}

export const BUILT_IN_PATTERNS: PatternOption[] = [
  { id: 'none', name: 'No Pattern', file: null },
  { id: 'cheetah', name: 'Cheetah', file: '/patterns/cheetah.jpg' },
  { id: 'leaf', name: 'Leaf', file: '/patterns/leaf.jpg' },
]
