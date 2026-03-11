import { useState, useCallback } from 'react'
import { loadSettings, saveSettings } from '../lib/settings'
import type { Settings } from '../types'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, updateSettings }
}
