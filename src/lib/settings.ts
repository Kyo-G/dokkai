import type { Settings, AIProvider } from '../types'

const SETTINGS_KEY = 'dokkai_settings'

export const defaultSettings: Settings = {
  provider: 'claude',
  claudeKey: '',
  openaiKey: '',
  geminiKey: '',
  deepseekKey: '',
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

export function getActiveApiKey(settings: Settings): string {
  switch (settings.provider) {
    case 'claude': return settings.claudeKey
    case 'openai': return settings.openaiKey
    case 'gemini': return settings.geminiKey
    default: return ''
  }
}

export function getProviderLabel(provider: AIProvider): string {
  switch (provider) {
    case 'claude': return 'Claude (Anthropic)'
    case 'openai': return 'GPT (OpenAI)'
    case 'gemini': return 'Gemini (Google)'
    case 'deepseek': return 'DeepSeek'
  }
}
