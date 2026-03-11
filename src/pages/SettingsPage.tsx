import { useState } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { testApiKey } from '../lib/ai'
import type { AIProvider } from '../types'

const PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'claude', label: 'Claude (Anthropic)', model: 'claude-haiku-4-5' },
  { value: 'openai', label: 'GPT (OpenAI)', model: 'gpt-4o-mini' },
  { value: 'gemini', label: 'Gemini (Google)', model: 'gemini-1.5-flash' },
  { value: 'deepseek', label: 'DeepSeek', model: 'deepseek-chat' },
]

type TestStatus = 'idle' | 'loading' | 'ok' | 'error'

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const [showKeys, setShowKeys] = useState({ claude: false, openai: false, gemini: false, deepseek: false })
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')

  function toggleShow(provider: AIProvider) {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }))
  }

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
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">设置</h1>
        <p className="text-sm text-gray-500 mt-1">配置 AI 服务提供商和 API Key</p>
      </div>

      {/* Provider selector */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">AI Provider</div>
        <div className="space-y-2">
          {PROVIDERS.map(({ value, label, model }) => (
            <button
              key={value}
              onClick={() => { updateSettings({ provider: value }); setTestStatus('idle') }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-colors
                ${settings.provider === value
                  ? 'border-red-700 bg-red-50'
                  : 'border-gray-200 bg-white'}`}
            >
              <div>
                <div className={`font-medium ${settings.provider === value ? 'text-red-700' : 'text-gray-900'}`}>
                  {label}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">使用 {model}</div>
              </div>
              {settings.provider === value && (
                <div className="w-4 h-4 rounded-full bg-red-700 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* API Keys */}
      <div className="space-y-4">
        <div className="text-sm font-medium text-gray-700">API Keys</div>

        {PROVIDERS.map(({ value, label }) => {
          const keyField = `${value}Key` as 'claudeKey' | 'openaiKey' | 'geminiKey' | 'deepseekKey'
          return (
            <div key={value}>
              <label className="text-xs text-gray-500 mb-1 block">{label}</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showKeys[value] ? 'text' : 'password'}
                    value={settings[keyField]}
                    onChange={e => updateSettings({ [keyField]: e.target.value })}
                    placeholder={`输入 ${label} API Key`}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm pr-10
                      focus:outline-none focus:border-red-400"
                  />
                  <button
                    onClick={() => toggleShow(value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showKeys[value] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Test button */}
      <div>
        <button
          onClick={handleTest}
          disabled={testStatus === 'loading'}
          className="w-full py-3 rounded-xl border-2 border-red-700 text-red-700 font-medium
            flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {testStatus === 'loading' && <Loader2 size={18} className="animate-spin" />}
          {testStatus === 'ok' && <CheckCircle size={18} className="text-green-600" />}
          {testStatus === 'error' && <XCircle size={18} className="text-red-600" />}
          {testStatus === 'idle' || testStatus === 'loading' ? '测试 API Key' : testStatus === 'ok' ? '连接成功！' : '连接失败'}
        </button>
        {testStatus === 'error' && testError && (
          <p className="text-red-600 text-xs mt-2 text-center">{testError}</p>
        )}
      </div>

      {/* Token usage hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="text-sm font-medium text-amber-800 mb-1">💡 Token 使用提示</div>
        <div className="text-xs text-amber-700 space-y-1">
          <p>• 每次句子分析约消耗 <strong>1000–3000 token</strong></p>
          <p>• 每次单词详情约消耗 <strong>500–1500 token</strong></p>
          <p>• 分析结果自动缓存，同一句子不会重复调用</p>
          <p>• 建议按需点击，不必一次分析整篇文章</p>
        </div>
      </div>

      {/* Supabase config hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="text-sm font-medium text-blue-800 mb-1">🗄️ 数据库配置</div>
        <div className="text-xs text-blue-700">
          请在项目根目录创建 <code className="bg-blue-100 px-1 rounded">.env</code> 文件并填写：<br />
          <code className="block mt-1 bg-blue-100 p-2 rounded text-[11px]">
            VITE_SUPABASE_URL=your_url<br />
            VITE_SUPABASE_ANON_KEY=your_key
          </code>
        </div>
      </div>
    </div>
  )
}
