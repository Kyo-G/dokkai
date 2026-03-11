import { useCallback, useRef, useState } from 'react'

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const speak = useCallback((text: string) => {
    // Stop anything currently playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()

    // First, try Web Speech API if a Japanese voice is available
    const voices = window.speechSynthesis?.getVoices() ?? []
    const jaVoice = voices.find(v => v.lang.startsWith('ja'))

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

    // Fallback: Google Translate TTS audio
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ja&client=tw-ob`
    const audio = new Audio(url)
    audio.onplay = () => setSpeaking(true)
    audio.onended = () => { setSpeaking(false); audioRef.current = null }
    audio.onerror = () => { setSpeaking(false); audioRef.current = null }
    audioRef.current = audio
    audio.play().catch(() => setSpeaking(false))
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  return { speak, stop, speaking }
}
