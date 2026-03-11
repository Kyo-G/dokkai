import { useCallback, useEffect } from 'react'
import { useState } from 'react'

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ja-JP'
    utter.rate = 0.9

    // Try to find a Japanese voice, but don't block if none found —
    // setting lang='ja-JP' alone is enough on most Android devices
    const voices = window.speechSynthesis.getVoices()
    const jaVoice =
      voices.find(v => v.lang === 'ja-JP' && v.localService) ||
      voices.find(v => v.lang === 'ja-JP') ||
      voices.find(v => v.lang.startsWith('ja'))
    if (jaVoice) utter.voice = jaVoice

    utter.onstart = () => setSpeaking(true)
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utter)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  return { speak, stop, speaking }
}
