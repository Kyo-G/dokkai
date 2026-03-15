import { useState, useEffect } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, ChevronRight, ChevronLeft } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { testApiKey } from '../lib/ai'
import type { AIProvider } from '../types'
import { useDarkMode } from '../hooks/useDarkMode'
import type { DarkModePreference } from '../hooks/useDarkMode'
import { getT } from '../lib/i18n'
import type { Translations } from '../lib/i18n'

const PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'claude', label: 'Claude', model: 'claude-haiku-4-5' },
  { value: 'openai', label: 'GPT', model: 'gpt-4o-mini' },
  { value: 'gemini', label: 'Gemini', model: 'gemini-1.5-flash' },
  { value: 'deepseek', label: 'DeepSeek', model: 'deepseek-chat' },
]

type Page = 'main' | 'ai' | 'jlpt' | 'voice'
type TestStatus = 'idle' | 'loading' | 'ok' | 'error'

// ─── Shared UI pieces ────────────────────────────────────────────

function SubPageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      <button onClick={onBack} className="p-1 -ml-2 text-gray-500 dark:text-gray-400">
        <ChevronLeft size={22} />
      </button>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-[#2a2a2a] overflow-hidden divide-y divide-gray-100 dark:divide-[#2a2a2a]">
      {children}
    </div>
  )
}

function Row({ label, value, onClick }: { label: string; value?: React.ReactNode; onClick?: () => void }) {
  if (onClick) {
    return (
      <button className="w-full flex items-center px-4 py-3.5 gap-3 text-left active:bg-gray-50 dark:active:bg-[#252525] transition-colors" onClick={onClick}>
        <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{label}</span>
        {value !== undefined && <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">{value}</span>}
        <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
      </button>
    )
  }
  return (
    <div className="flex items-center px-4 py-3.5 gap-3">
      <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{label}</span>
      {value !== undefined && <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">{value}</span>}
    </div>
  )
}

// ─── Sub-pages ───────────────────────────────────────────────────

type SubProps = {
  onBack: () => void
  settings: ReturnType<typeof useSettings>['settings']
  updateSettings: ReturnType<typeof useSettings>['updateSettings']
  t: Translations
}

function AISettingsPage({ onBack, settings, updateSettings, t }: SubProps) {
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')

  const keyField = `${settings.provider}Key` as 'claudeKey' | 'openaiKey' | 'geminiKey' | 'deepseekKey'
  const activeProvider = PROVIDERS.find(p => p.value === settings.provider)!

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
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <SubPageHeader title="AI" onBack={onBack} />

      {/* Provider */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide px-1">Provider</div>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map(({ value, label, model }) => (
            <button
              key={value}
              onClick={() => { updateSettings({ provider: value }); setTestStatus('idle') }}
              className={`flex flex-col px-4 py-3 rounded-xl border-2 text-left transition-colors
                ${settings.provider === value
                  ? 'border-red-700 bg-red-50 dark:bg-red-950/30'
                  : 'border-gray-100 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e]'}`}
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
        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide px-1">{activeProvider.label} API Key</div>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={settings[keyField]}
            onChange={e => { updateSettings({ [keyField]: e.target.value }); setTestStatus('idle') }}
            placeholder={t.apiKeyPlaceholder}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 text-sm pr-11 focus:outline-none focus:border-red-400"
          />
          <button
            onClick={() => setShowKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          >
            {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <button
          onClick={handleTest}
          disabled={testStatus === 'loading' || !settings[keyField]}
          className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors
            ${testStatus === 'ok'
              ? 'bg-green-50 dark:bg-green-950/30 text-green-700 border border-green-200 dark:border-green-800'
              : testStatus === 'error'
                ? 'bg-red-50 dark:bg-red-950/30 text-red-700 border border-red-200 dark:border-red-800'
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

      {/* Unsplash */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide px-1">{t.unsplashKeyLabel}</div>
        <p className="text-xs text-gray-500 dark:text-gray-400 px-1">{t.unsplashKeyHint}</p>
        <input
          type="password"
          value={settings.unsplashKey}
          onChange={e => updateSettings({ unsplashKey: e.target.value })}
          placeholder="your-unsplash-access-key"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-red-400"
        />
      </div>
    </div>
  )
}

function JlptPage({ onBack, settings, updateSettings, t }: SubProps) {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <SubPageHeader title={t.myJlptLevel} onBack={onBack} />
      <p className="text-sm text-gray-500 dark:text-gray-400">{t.jlptHint}</p>
      <div className="flex gap-2">
        {(['', 'N5', 'N4', 'N3', 'N2', 'N1'] as const).map(level => (
          <button
            key={level}
            onClick={() => updateSettings({ userLevel: level })}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors
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
  )
}

function VoicePage({ onBack, t }: { onBack: () => void; t: Translations }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    function load() { setVoices(window.speechSynthesis.getVoices()) }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  function handleRefresh() {
    const u = new SpeechSynthesisUtterance('')
    window.speechSynthesis.speak(u)
    window.speechSynthesis.cancel()
    setTimeout(() => setVoices(window.speechSynthesis.getVoices()), 300)
  }

  const hasJapanese = voices.some(v => v.lang.startsWith('ja'))

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <SubPageHeader title={t.speechDiagnostic} onBack={onBack} />

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{t.voiceCount(voices.length)}</span>
        <button
          onClick={handleRefresh}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-400"
        >
          {t.refresh}
        </button>
      </div>

      {voices.length > 0 && !hasJapanese && (
        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-2.5">
          {t.noJapaneseVoice}
        </p>
      )}

      <Card>
        {voices.length === 0
          ? <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">{t.noVoices}</div>
          : voices.map((v, i) => (
            <div
              key={i}
              className={`px-4 py-2.5 text-xs ${v.lang.startsWith('ja') ? 'text-green-700 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {v.name} <span className="opacity-50">— {v.lang}</span>
            </div>
          ))
        }
      </Card>
    </div>
  )
}

// ─── Main settings page ──────────────────────────────────────────

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const { darkMode, setDarkMode } = useDarkMode()
  const t = getT(settings.language)
  const [page, setPage] = useState<Page>('main')

  const activeProvider = PROVIDERS.find(p => p.value === settings.provider)!

  if (page === 'ai') return <AISettingsPage onBack={() => setPage('main')} settings={settings} updateSettings={updateSettings} t={t} />
  if (page === 'jlpt') return <JlptPage onBack={() => setPage('main')} settings={settings} updateSettings={updateSettings} t={t} />
  if (page === 'voice') return <VoicePage onBack={() => setPage('main')} t={t} />

  const DARK_MODE_OPTIONS: { value: DarkModePreference; label: string }[] = [
    { value: 'system', label: t.followSystem },
    { value: 'light', label: t.light },
    { value: 'dark', label: t.dark },
  ]

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.settingsTitle}</h1>

      {/* Language & Appearance — quick toggles */}
      <Card>
        <div className="flex items-center px-4 py-3 gap-3">
          <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{t.languageLabel}</span>
          <div className="flex bg-gray-100 dark:bg-[#2a2a2a] rounded-lg p-0.5">
            {(['zh', 'en'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => updateSettings({ language: lang })}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors
                  ${settings.language === lang
                    ? 'bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'}`}
              >
                {lang === 'zh' ? '中文' : 'EN'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center px-4 py-3 gap-3">
          <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{t.appearance}</span>
          <div className="flex bg-gray-100 dark:bg-[#2a2a2a] rounded-lg p-0.5">
            {DARK_MODE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDarkMode(value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors
                  ${darkMode === value
                    ? 'bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Detail pages */}
      <Card>
        <Row label="AI" value={activeProvider.label} onClick={() => setPage('ai')} />
        <Row label={t.myJlptLevel} value={settings.userLevel || t.noLimit} onClick={() => setPage('jlpt')} />
        <Row label={t.speechDiagnostic} onClick={() => setPage('voice')} />
      </Card>
    </div>
  )
}
