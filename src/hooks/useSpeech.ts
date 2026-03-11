import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Pick a Japanese voice when available
  function getJapaneseVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices()
    return (
      voices.find(v => v.lang === 'ja-JP' && v.localService) ||
      voices.find(v => v.lang === 'ja-JP') ||
      voices.find(v => v.lang.startsWith('ja')) ||
      null
    )
  }

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return

    // Stop any ongoing speech
    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ja-JP'
    utter.rate = 0.9
    utter.pitch = 1

    const voice = getJapaneseVoice()
    if (voice) utter.voice = voice

    utter.onstart = () => setSpeaking(true)
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)

    utteranceRef.current = utter
    window.speechSynthesis.speak(utter)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  // Cancel on unmount
  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  return { speak, stop, speaking }
}
