/**
 * Local dictionary service — JMdict + Kanjium + Tatoeba.
 *
 * Words are stored in /public/dict/words.json, downloaded once and
 * cached in IndexedDB. After init, lookups are synchronous O(1).
 */

export interface DictEntry {
  r: string        // primary reading (kana)
  pos: string      // part of speech (Chinese label)
  zh?: string[]    // Chinese meanings
  en?: string[]    // English meanings (fallback when no Chinese)
  p?: number       // pitch accent nucleus position
  ex?: { j: string; c: string }[]  // Tatoeba example sentences
}

type RawEntry = DictEntry | { _a: string }   // { _a: "kanji" } = alias

// ── Singleton state ────────────────────────────────────────────────────
let dictData: Record<string, RawEntry> | null = null
let initPromise: Promise<void> | null = null

export type DictStatus = 'idle' | 'loading' | 'ready' | 'unavailable'
let dictStatus: DictStatus = 'idle'

const IDB_DB    = 'dokkai-dict'
const IDB_STORE = 'kv'
const IDB_KEY   = 'words-v1'

// ── IndexedDB helpers ──────────────────────────────────────────────────
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1)
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror   = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => reject(req.error)
  })
}

async function idbPut(key: string, value: string): Promise<void> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ── Public API ─────────────────────────────────────────────────────────
export function getDictStatus(): DictStatus { return dictStatus }

/**
 * Initialise the dictionary. Safe to call multiple times.
 * Returns immediately once already loaded.
 */
export function initDict(): Promise<void> {
  if (dictData !== null) return Promise.resolve()
  if (initPromise)       return initPromise

  dictStatus    = 'loading'
  initPromise   = (async () => {
    try {
      // Try IndexedDB cache first
      let json = await idbGet(IDB_KEY).catch(() => null)

      if (!json) {
        const res = await fetch('/dict/words.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        json = await res.text()
        idbPut(IDB_KEY, json).catch(() => {}) // best-effort cache
      }

      dictData   = JSON.parse(json)
      dictStatus = 'ready'
    } catch (e) {
      console.warn('[dict] Dictionary unavailable:', e)
      dictData   = {}           // empty → all lookups return null → fall back to AI
      dictStatus = 'unavailable'
    }
  })()

  return initPromise
}

/** Synchronous lookup — call after initDict() resolves. */
function lookupWord(word: string, kana?: string): DictEntry | null {
  if (!dictData) return null

  function resolve(key: string): DictEntry | null {
    let entry = dictData![key]
    if (!entry) return null
    // Follow alias
    if ('_a' in entry) entry = dictData![(entry as { _a: string })._a]
    if (!entry || '_a' in entry) return null
    return entry as DictEntry
  }

  return resolve(word) ?? (kana && kana !== word ? resolve(kana) : null)
}

/** Async version: initialises dict if not ready, then looks up. */
export async function lookupWordAsync(word: string, kana?: string): Promise<DictEntry | null> {
  await initDict()
  return lookupWord(word, kana)
}

