import { useState, useEffect } from 'react'

export type DarkModePreference = 'light' | 'dark' | 'system'

function applyDarkClass(pref: DarkModePreference) {
  const html = document.documentElement
  let isDark: boolean
  if (pref === 'dark') {
    isDark = true
  } else if (pref === 'light') {
    isDark = false
  } else {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  isDark ? html.classList.add('dark') : html.classList.remove('dark')

  // Update theme-color for status bar
  const color = isDark ? '#111111' : '#f8f7f4'
  document.querySelectorAll('meta[name="theme-color"]').forEach(el => {
    el.setAttribute('content', color)
  })
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
