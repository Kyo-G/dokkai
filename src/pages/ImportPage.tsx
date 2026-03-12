import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Link } from 'lucide-react'
import { createArticle } from '../lib/db'
import type { ArticleLevel } from '../types'

const LEVELS: ArticleLevel[] = ['', 'N5', 'N4', 'N3', 'N2', 'N1']

export default function ImportPage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [level, setLevel] = useState<ArticleLevel>('')
  const [saving, setSaving] = useState(false)

  async function handleFetch() {
    if (!url.trim()) return
    setFetching(true)
    setFetchError('')
    try {
      const res = await fetch(`/api/fetch-article?url=${encodeURIComponent(url.trim())}`)
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || `请求失败 (${res.status})`)
      }
      const data = await res.json() as { title: string; content: string }
      if (data.title && !title) setTitle(data.title)
      setContent(data.content)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '抓取失败，请手动粘贴内容')
    } finally {
      setFetching(false)
    }
  }

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
    <div className="flex flex-col h-dvh bg-[#f8f7f4] dark:bg-[#111]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#f8f7f4] dark:bg-[#111] border-b border-gray-100 dark:border-[#2a2a2a]">
        <button onClick={() => navigate(-1)} className="p-1 text-gray-500 dark:text-gray-400">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 flex-1">导入新文章</h1>
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

        {/* URL fetch */}
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">从网址导入（选填）</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetch()}
                placeholder="https://www3.nhk.or.jp/news/…"
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 dark:border-[#333] rounded-xl text-sm bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-red-400"
              />
            </div>
            <button
              onClick={handleFetch}
              disabled={fetching || !url.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white rounded-xl text-sm font-medium disabled:opacity-40 shrink-0"
            >
              {fetching ? <Loader2 size={14} className="animate-spin" /> : '抓取'}
            </button>
          </div>
          {fetchError && (
            <p className="text-xs text-red-500 mt-1.5">{fetchError}</p>
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-[#2a2a2a]" />

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">标题（选填）</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="文章标题"
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#333] rounded-xl text-sm bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-red-400"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">难度（选填）</label>
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
                {l || '不指定'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">日语文本 *</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="粘贴日语文章内容，或从上方输入网址自动抓取…"
            rows={12}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#333] rounded-xl text-sm font-jp bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600
              focus:outline-none focus:border-red-400 resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  )
}
