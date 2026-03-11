import { useState, useEffect } from 'react'

export type DarkModePreference = 'light' | 'dark' | 'system'

function applyDarkClass(pref: DarkModePreference) {
  const html = document.documentElement
  if (pref === 'dark') {
    html.classList.add('dark')
  } else if (pref === 'light') {
    html.classList.remove('dark')
  } else {
    // system
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }
}

export function useDarkMode() {
  const [darkMode, setDarkModeState] = useState<DarkModePreference>(() => {
    const stored = localStorage.getItem('darkMode')
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    return 'system'
  })

  useEffect(() => {
    applyDarkClass(darkMode)

    if (darkMode !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyDarkClass('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [darkMode])

  function setDarkMode(pref: DarkModePreference) {
    localStorage.setItem('darkMode', pref)
    setDarkModeState(pref)
  }

  return { darkMode, setDarkMode }
}
