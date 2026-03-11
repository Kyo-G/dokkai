import { useState, useEffect } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { testApiKey } from '../lib/ai'
import type { AIProvider } from '../types'

const PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'claude', label: 'Claude', model: 'claude-haiku-4-5' },
  { value: 'openai', label: 'GPT', model: 'gpt-4o-mini' },
  { value: 'gemini', label: 'Gemini', model: 'gemini-1.5-flash' },
  { value: 'deepseek', label: 'DeepSeek', model: 'deepseek-chat' },
]

type TestStatus = 'idle' | 'loading' | 'ok' | 'error'

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')

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
      setTestError(e instanceof Error ? e.message : '测试失败')
    }
  }

  return (
    <div className="px-4 py-8 space-y-8 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900">设置</h1>

      {/* Provider selector */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 uppercase tracking-wide">AI Provider</div>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map(({ value, label, model }) => (
            <button
              key={value}
              onClick={() => { updateSettings({ provider: value }); setTestStatus('idle') }}
              className={`flex flex-col px-4 py-3 rounded-xl border-2 text-left transition-colors
                ${settings.provider === value
                  ? 'border-red-700 bg-red-50'
                  : 'border-gray-100 bg-white text-gray-500'}`}
            >
              <span className={`font-medium text-sm ${settings.provider === value ? 'text-red-700' : ''}`}>
                {label}
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5">{model}</span>
            </button>
          ))}
        </div>
      </div>

      {/* API Key — only active provider */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 uppercase tracking-wide">{activeProvider.label} API Key</div>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={settings[keyField]}
            onChange={e => { updateSettings({ [keyField]: e.target.value }); setTestStatus('idle') }}
            placeholder="粘贴 API Key…"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm pr-11
              focus:outline-none focus:border-red-400"
          />
          <button
            onClick={() => setShowKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
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
                : 'border border-gray-200 text-gray-600 disabled:opacity-40'}`}
        >
          {testStatus === 'loading' && <Loader2 size={15} className="animate-spin" />}
          {testStatus === 'ok' && <CheckCircle size={15} />}
          {testStatus === 'error' && <XCircle size={15} />}
          {testStatus === 'idle' ? '测试连接' : testStatus === 'loading' ? '测试中…' : testStatus === 'ok' ? '连接成功' : '连接失败'}
        </button>
        {testStatus === 'error' && testError && (
          <p className="text-red-500 text-xs text-center">{testError}</p>
        )}
      </div>
      {/* TTS diagnostic */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 uppercase tracking-wide">语音诊断</div>
        <button
          onClick={() => setShowVoices(v => !v)}
          className="w-full py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600"
        >
          {showVoices ? '收起' : `查看设备已安装的语音（共 ${voices.length} 个）`}
        </button>
        {showVoices && (
          <div className="bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
            {voices.length === 0
              ? <p className="text-xs text-gray-400">暂未检测到语音，请稍后再试</p>
              : voices.map((v, i) => (
                <div key={i} className={`text-xs px-2 py-1 rounded ${v.lang.startsWith('ja') ? 'bg-green-100 text-green-800 font-medium' : 'text-gray-500'}`}>
                  {v.name} — {v.lang}
                </div>
              ))
            }
          </div>
        )}
        {voices.length > 0 && !voices.some(v => v.lang.startsWith('ja')) && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
            未检测到日语语音包。请在手机「设置 → 语言 → 文字转语音 → 安装语音数据」中下载日语。
          </p>
        )}
      </div>
    </div>
  )
}
