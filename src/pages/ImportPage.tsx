import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createArticle } from '../lib/db'
import type { ArticleLevel } from '../types'
import { useSettings } from '../hooks/useSettings'
import { getT } from '../lib/i18n'

const LEVELS: ArticleLevel[] = ['', 'N5', 'N4', 'N3', 'N2', 'N1']

export default function ImportPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const t = getT(settings.language)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [level, setLevel] = useState<ArticleLevel>('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    try {
      const article = await createArticle(title.trim(), content.trim(), level)
      navigate(`/article/${article.id}`, { replace: true })
    } catch (e) {
      alert(e instanceof Error ? e.message : t.save)
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-[#f8f7f4] dark:bg-[#111]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#f8f7f4] dark:bg-[#111] border-b border-gray-100 dark:border-[#2a2a2a]">
        <button onClick={() => navigate(-1)} className="p-1 text-gray-500 dark:text-gray-400">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 flex-1">{t.importPageTitle}</h1>
        <button
          onClick={handleSave}
          disabled={!content.trim() || saving}
          className="flex items-center gap-1.5 bg-red-700 text-white px-4 py-1.5 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t.save}
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t.titleLabel}</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t.titlePlaceholder}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#333] rounded-xl text-sm bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-red-400"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t.levelLabel}</label>
          <div className="flex gap-2 flex-wrap">
            {LEVELS.map(l => (
              <button
                key={l || 'none'}
                onClick={() => setLevel(l)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                  ${level === l
                    ? 'border-red-700 bg-red-50 dark:bg-red-950/30 text-red-700'
                    : 'border-gray-200 dark:border-[#333] bg-white dark:bg-[#1e1e1e] text-gray-600 dark:text-gray-400'}`}
              >
                {l || t.unspecified}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t.contentLabel}</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={t.contentPlaceholder}
            rows={12}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#333] rounded-xl text-sm font-jp bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600
              focus:outline-none focus:border-red-400 resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  )
}
