interface ArticleProgress {
  readIds: string[]
  total: number
  lastReadId: string | null
  lastMode?: 'read' | 'study'
}

const empty = (): ArticleProgress => ({ readIds: [], total: 0, lastReadId: null })

function key(articleId: string) { return `dokkai_progress_${articleId}` }

export function getProgress(articleId: string): ArticleProgress {
  try {
    return JSON.parse(localStorage.getItem(key(articleId)) || 'null') ?? empty()
  } catch { return empty() }
}

export function markSentenceRead(articleId: string, sentenceId: string, total: number): void {
  const p = getProgress(articleId)
  if (!p.readIds.includes(sentenceId)) p.readIds.push(sentenceId)
  p.lastReadId = sentenceId
  p.total = total
  try { localStorage.setItem(key(articleId), JSON.stringify(p)) } catch {}
}

export function saveLastPosition(articleId: string, sentenceId: string, mode: 'read' | 'study'): void {
  const p = getProgress(articleId)
  p.lastReadId = sentenceId
  p.lastMode = mode
  try { localStorage.setItem(key(articleId), JSON.stringify(p)) } catch {}
}

export function saveMode(articleId: string, mode: 'read' | 'study'): void {
  const p = getProgress(articleId)
  p.lastMode = mode
  try { localStorage.setItem(key(articleId), JSON.stringify(p)) } catch {}
}

export function clearProgress(articleId: string): void {
  localStorage.removeItem(key(articleId))
}
