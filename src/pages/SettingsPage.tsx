import { useState, useEffect } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { testApiKey } from '../lib/ai'
import type { AIProvider } from '../types'
import { useDarkMode } from '../hooks/useDarkMode'
import type { DarkModePreference } from '../hooks/useDarkMode'
import { getT } from '../lib/i18n'

const PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'claude', label: 'Claude', model: 'claude-haiku-4-5' },
  { value: 'openai', label: 'GPT', model: 'gpt-4o-mini' },
  { value: 'gemini', label: 'Gemini', model: 'gemini-1.5-flash' },
  { value: 'deepseek', label: 'DeepSeek', model: 'deepseek-chat' },
]

type TestStatus = 'idle' | 'loading' | 'ok' | 'error'

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const { darkMode, setDarkMode } = useDarkMode()
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')
  const t = getT(settings.language)

  const DARK_MODE_OPTIONS: { value: DarkModePreference; label: string }[] = [
    { value: 'system', label: t.followSystem },
    { value: 'light', label: t.light },
    { value: 'dark', label: t.dark },
  ]

  const keyField = `${settings.provider}Key` as 'claudeKey' | 'openaiKey' | 'geminiKey' | 'deepseekKey'
  const activeProvider = PROVIDERS.find(p => p.value === settings.provider)!
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [showVoices, setShowVoices] = useState(false)

  useEffect(() => {
    function load() { setVoices(window.speechSynthesis.getVoices()) }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  async function handleTest() {
    setTestStatus('loading')
    setTestError('')
    try {
      await testApiKey(settings)
      setTestStatus('ok')
    } catch (e) {
      setTestStatus('error')
      setTestError(e instanceof Error ? e.message : t.connectionFailed)
    }
  }

  return (
    <div className="px-4 py-8 space-y-8 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.settingsTitle}</h1>

      {/* Language */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t.languageLabel}</div>
        <div className="flex bg-gray-100 dark:bg-[#2a2a2a] rounded-xl p-1">
          {(['zh', 'en'] as const).map(lang => (
            <button
              key={lang}
              onClick={() => updateSettings({ language: lang })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                ${settings.language === lang
                  ? 'bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'}`}
            >
              {lang === 'zh' ? '中文' : 'English'}
            </button>
          ))}
        </div>
      </div>

      {/* Dark mode */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t.appearance}</div>
        <div className="flex bg-gray-100 dark:bg-[#2a2a2a] rounded-xl p-1">
          {DARK_MODE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setDarkMode(value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                ${darkMode === value
                  ? 'bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Provider selector */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">AI Provider</div>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map(({ value, label, model }) => (
            <button
              key={value}
              onClick={() => { updateSettings({ provider: value }); setTestStatus('idle') }}
              className={`flex flex-col px-4 py-3 rounded-xl border-2 text-left transition-colors
                ${settings.provider === value
                  ? 'border-red-700 bg-red-50 dark:bg-red-950/30'
                  : 'border-gray-100 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] text-gray-500 dark:text-gray-400'}`}
            >
              <span className={`font-medium text-sm ${settings.provider === value ? 'text-red-700' : 'text-gray-900 dark:text-gray-100'}`}>
                {label}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{model}</span>
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{activeProvider.label} API Key</div>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={settings[keyField]}
            onChange={e => { updateSettings({ [keyField]: e.target.value }); setTestStatus('idle') }}
            placeholder={t.apiKeyPlaceholder}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 text-sm pr-11
              focus:outline-none focus:border-red-400"
          />
          <button
            onClick={() => setShowKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          >
            {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        {/* Test button */}
        <button
          onClick={handleTest}
          disabled={testStatus === 'loading' || !settings[keyField]}
          className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors
            ${testStatus === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : testStatus === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'border border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-400 disabled:opacity-40'}`}
        >
          {testStatus === 'loading' && <Loader2 size={15} className="animate-spin" />}
          {testStatus === 'ok' && <CheckCircle size={15} />}
          {testStatus === 'error' && <XCircle size={15} />}
          {testStatus === 'idle' ? t.testConnection : testStatus === 'loading' ? t.testing : testStatus === 'ok' ? t.connected : t.connectionFailed}
        </button>
        {testStatus === 'error' && testError && (
          <p className="text-red-500 text-xs text-center">{testError}</p>
        )}
      </div>

      {/* JLPT level filter */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t.myJlptLevel}</div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t.jlptHint}</p>
        <div className="flex gap-2">
          {(['', 'N5', 'N4', 'N3', 'N2', 'N1'] as const).map(level => (
            <button
              key={level}
              onClick={() => updateSettings({ userLevel: level })}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                ${settings.userLevel === level
                  ? 'bg-red-700 text-white border-red-700'
                  : 'border-gray-200 dark:border-[#333] text-gray-500 dark:text-gray-400'}`}
            >
              {level || t.noLimit}
            </button>
          ))}
        </div>
        {settings.userLevel && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t.jlptHiding(
              settings.userLevel === 'N5' ? t.jlptN5None :
              settings.userLevel === 'N4' ? 'N5' :
              settings.userLevel === 'N3' ? 'N5、N4' :
              settings.userLevel === 'N2' ? 'N5、N4、N3' :
              'N5、N4、N3、N2'
            )}
          </p>
        )}
      </div>

      {/* TTS diagnostic */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t.speechDiagnostic}</div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowVoices(v => !v)}
            className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-400"
          >
            {showVoices ? t.collapse : t.voiceCount(voices.length)}
          </button>
          <button
            onClick={() => {
              const u = new SpeechSynthesisUtterance('')
              window.speechSynthesis.speak(u)
              window.speechSynthesis.cancel()
              setTimeout(() => setVoices(window.speechSynthesis.getVoices()), 300)
            }}
            className="px-3 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-400"
          >
            {t.refresh}
          </button>
        </div>
        {showVoices && (
          <div className="bg-gray-50 dark:bg-[#252525] rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
            {voices.length === 0
              ? <p className="text-xs text-gray-400 dark:text-gray-500">{t.noVoices}</p>
              : voices.map((v, i) => (
                <div key={i} className={`text-xs px-2 py-1 rounded ${v.lang.startsWith('ja') ? 'bg-green-100 text-green-800 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                  {v.name} — {v.lang}
                </div>
              ))
            }
          </div>
        )}
        {voices.length > 0 && !voices.some(v => v.lang.startsWith('ja')) && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-2">
            {t.noJapaneseVoice}
          </p>
        )}
      </div>
    </div>
  )
}
