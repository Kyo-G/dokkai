/**
 * Split Japanese text into sentences.
 * Splits on 。！？ and keeps the delimiter with the sentence.
 */
export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  // Split on sentence-ending punctuation, keeping the delimiter
  const parts = trimmed.split(/(?<=[。！？\n])|(?=\n)/)
  const sentences: string[] = []

  for (const part of parts) {
    const s = part.trim()
    if (s.length > 0) {
      sentences.push(s)
    }
  }

  // If no splits occurred (no Japanese punctuation), split by newlines or return whole
  if (sentences.length === 0) return [trimmed]
  return sentences
}
