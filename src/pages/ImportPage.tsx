import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createArticle } from '../lib/db'
import type { ArticleLevel } from '../types'

const LEVELS: ArticleLevel[] = ['', 'N5', 'N4', 'N3', 'N2', 'N1']

export default function ImportPage() {
  const navigate = useNavigate()
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
      alert(e instanceof Error ? e.message : '保存失败')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-[#f8f7f4]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#f8f7f4] border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-1 text-gray-500">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1">导入新文章</h1>
        <button
          onClick={handleSave}
          disabled={!content.trim() || saving}
          className="flex items-center gap-1.5 bg-red-700 text-white px-4 py-1.5 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          保存
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">标题（选填）</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="文章标题"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-red-400"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">难度（选填）</label>
          <div className="flex gap-2 flex-wrap">
            {LEVELS.map(l => (
              <button
                key={l || 'none'}
                onClick={() => setLevel(l)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                  ${level === l
                    ? 'border-red-700 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-600'}`}
              >
                {l || '不指定'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">日语文本 *</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="粘贴日语文章内容…"
            rows={12}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-jp bg-white
              focus:outline-none focus:border-red-400 resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  )
}
