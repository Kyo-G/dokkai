import { useCallback, useRef, useState } from 'react'
import { getAudioUrl } from '../lib/audioCache'

/** getVoices() is async on first call — wait for voiceschanged if empty */
function resolveJapaneseVoice(): Promise<SpeechSynthesisVoice | null> {
  const synth = window.speechSynthesis
  if (!synth) return Promise.resolve(null)

  const voices = synth.getVoices()
  const ja = voices.find(v => v.lang.startsWith('ja'))
  if (ja) return Promise.resolve(ja)

  // Voices not yet loaded; wait up to 1 s for voiceschanged
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), 1000)
    synth.addEventListener('voiceschanged', () => {
      clearTimeout(timer)
      resolve(synth.getVoices().find(v => v.lang.startsWith('ja')) ?? null)
    }, { once: true })
  })
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cancelRef = useRef(false)
  // Called when we need to abort the currently-playing item mid-way
  const stopCurrentRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    cancelRef.current = true
    if (stopCurrentRef.current) { stopCurrentRef.current(); stopCurrentRef.current = null }
    window.speechSynthesis?.cancel()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setSpeaking(false)
  }, [])

  /** Speak a single text. Resolves when done (or when stop() is called). */
  const speakOne = useCallback(async (text: string): Promise<void> => {
    if (cancelRef.current) return

    const jaVoice = await resolveJapaneseVoice()
    if (cancelRef.current) return

    if (jaVoice) {
      await new Promise<void>(resolve => {
        stopCurrentRef.current = () => { window.speechSynthesis.cancel(); resolve() }
        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = 'ja-JP'
        utter.voice = jaVoice
        utter.rate = 0.9
        utter.onend = () => { stopCurrentRef.current = null; resolve() }
        utter.onerror = () => { stopCurrentRef.current = null; resolve() }
        window.speechSynthesis.speak(utter)
      })
      return
    }

    // Fallback: fetch via proxy (with IndexedDB cache)
    try {
      const url = await getAudioUrl(text)
      if (cancelRef.current) return
      await new Promise<void>(resolve => {
        const audio = new Audio(url)
        audioRef.current = audio
        const done = () => { stopCurrentRef.current = null; audioRef.current = null; resolve() }
        audio.onended = done
        audio.onerror = done
        stopCurrentRef.current = () => { audio.pause(); done() }
        audio.play().catch(done)
      })
    } catch { /* ignore */ }
  }, [])

  /** Speak a single text (one-shot). */
  const speak = useCallback(async (text: string) => {
    stop()
    cancelRef.current = false
    setSpeaking(true)
    await speakOne(text)
    if (!cancelRef.current) setSpeaking(false)
  }, [stop, speakOne])

  /**
   * Speak a sequence of items one by one.
   * @param items     Array of { id, text } to speak in order.
   * @param startIndex Index to start from.
   * @param onItem    Called with the current item's id before it is spoken,
   *                  and with null when the sequence ends or is stopped.
   */
  const speakSequence = useCallback(async (
    items: { id: string; text: string }[],
    startIndex: number,
    onItem: (id: string | null) => void,
  ) => {
    stop()
    cancelRef.current = false
    setSpeaking(true)
    for (let i = startIndex; i < items.length; i++) {
      if (cancelRef.current) break
      onItem(items[i].id)
      await speakOne(items[i].text)
    }
    onItem(null)
    setSpeaking(false)
  }, [stop, speakOne])

  return { speak, stop, speaking, speakSequence }
}
