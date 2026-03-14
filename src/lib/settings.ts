import type { Settings } from '../types'

const SETTINGS_KEY = 'dokkai_settings'

export const defaultSettings: Settings = {
  provider: 'claude',
  claudeKey: '',
  openaiKey: '',
  geminiKey: '',
  deepseekKey: '',
  userLevel: '',
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultSettings }
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

