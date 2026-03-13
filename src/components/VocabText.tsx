import type { WordInSentence } from '../types'

export function vocabTextClass(interval: number): string {
  if (interval <= 3)  return 'text-red-600 dark:text-red-400 font-semibold'
  if (interval <= 10) return 'text-orange-500 dark:text-orange-400 font-medium'
  return 'text-gray-400 dark:text-gray-500'
}

export function vocabCardClass(interval: number): string {
  if (interval <= 3)  return 'bg-red-50 dark:bg-red-950/30'
  if (interval <= 10) return 'bg-orange-50 dark:bg-orange-950/30'
  return 'bg-gray-100 dark:bg-[#2a2a2a]'
}

interface Props {
  text: string
  analysisWords?: WordInSentence[]
  vocabIndex: Map<string, number>
  className?: string
  lang?: string
}

/**
 * Renders text with known-but-unmastered vocabulary words highlighted in color.
 * Uses the sentence's word analysis to find word boundaries.
 */
export default function VocabText({ text, analysisWords, vocabIndex, className, lang }: Props) {
  if (!analysisWords || vocabIndex.size === 0) {
    return <span className={className} lang={lang}>{text}</span>
  }

  const matches: { start: number; end: number; interval: number }[] = []

  for (const w of analysisWords) {
    const interval = vocabIndex.get(w.word)
    if (interval === undefined) continue
    const idx = text.indexOf(w.word)
    if (idx === -1) continue
    matches.push({ start: idx, end: idx + w.word.length, interval })
  }

  if (matches.length === 0) {
    return <span className={className} lang={lang}>{text}</span>
  }

  // Sort by position, drop overlapping matches
  matches.sort((a, b) => a.start - b.start)
  const deduped: typeof matches = []
  let lastEnd = 0
  for (const m of matches) {
    if (m.start >= lastEnd) {
      deduped.push(m)
      lastEnd = m.end
    }
  }

  const nodes: React.ReactNode[] = []
  let pos = 0
  for (const m of deduped) {
    if (m.start > pos) nodes.push(text.slice(pos, m.start))
    nodes.push(
      <span key={m.start} className={vocabTextClass(m.interval)}>
        {text.slice(m.start, m.end)}
      </span>
    )
    pos = m.end
  }
  if (pos < text.length) nodes.push(text.slice(pos))

  return <span className={className} lang={lang}>{nodes}</span>
}
