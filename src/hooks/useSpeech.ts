import { useCallback, useEffect, useState } from 'react'

function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find(v => v.lang === 'ja-JP' && v.localService) ||
    voices.find(v => v.lang === 'ja-JP') ||
    voices.find(v => v.lang.startsWith('ja')) ||
    null
  )
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  // Load voices — Android Chrome fires voiceschanged asynchronously
  useEffect(() => {
    function loadVoices() {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0) setVoices(v)
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ja-JP'
    utter.rate = 0.9

    const jaVoice = pickJapaneseVoice()
    if (jaVoice) {
      utter.voice = jaVoice
    } else {
      // No Japanese voice found — alert user once
      console.warn('未找到日语语音，请在系统设置中安装日语 TTS')
    }

    utter.onstart = () => setSpeaking(true)
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utter)
  }, [voices]) // re-create when voices load

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  const hasJapaneseVoice = voices.some(v => v.lang.startsWith('ja'))

  return { speak, stop, speaking, hasJapaneseVoice }
}
