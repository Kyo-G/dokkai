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

  const speak = useCallback(async (text: string) => {
    // Stop anything playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()

    // Prefer local Japanese voice if available
    const jaVoice = await resolveJapaneseVoice()
    if (jaVoice) {
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'ja-JP'
      utter.voice = jaVoice
      utter.rate = 0.9
      utter.onstart = () => setSpeaking(true)
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utter)
      return
    }

    // Fallback: fetch via proxy (with IndexedDB cache)
    setSpeaking(true)
    try {
      const url = await getAudioUrl(text)
      const audio = new Audio(url)
      audio.onended = () => { setSpeaking(false); audioRef.current = null }
      audio.onerror = () => { setSpeaking(false); audioRef.current = null }
      audioRef.current = audio
      await audio.play()
    } catch {
      setSpeaking(false)
    }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  return { speak, stop, speaking }
}
