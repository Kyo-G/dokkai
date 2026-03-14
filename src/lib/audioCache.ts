const DB_NAME = 'dokkai_audio'
const STORE = 'audio'

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'text' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getCachedBlob(text: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    return new Promise(resolve => {
      const req = db.transaction(STORE).objectStore(STORE).get(text)
      req.onsuccess = () => resolve(req.result?.blob ?? null)
      req.onerror = () => resolve(null)
    })
  } catch { return null }
}

async function storeBlob(text: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ text, blob })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* non-fatal */ }
}

async function fetchTTS(text: string): Promise<Blob> {
  const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`)
  if (!res.ok) throw new Error('TTS 请求失败')
  return res.blob()
}

/** Returns a blob URL — checks cache first, fetches & caches if not found */
export async function getAudioUrl(text: string): Promise<string> {
  const cached = await getCachedBlob(text)
  if (cached) return URL.createObjectURL(cached)

  const blob = await fetchTTS(text)
  await storeBlob(text, blob)
  return URL.createObjectURL(blob)
}
