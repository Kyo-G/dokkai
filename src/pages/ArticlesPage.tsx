import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, Trash2, FileText, Loader2 } from 'lucide-react'
import { getArticles, createArticle, deleteArticle } from '../lib/db'
import type { Article, ArticleLevel } from '../types'

const LEVELS: ArticleLevel[] = ['', 'N5', 'N4', 'N3', 'N2', 'N1']
const LEVEL_COLORS: Record<string, string> = {
  N5: 'bg-green-100 text-green-700',
  N4: 'bg-blue-100 text-blue-700',
  N3: 'bg-yellow-100 text-yellow-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [level, setLevel] = useState<ArticleLevel>('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await getArticles()
      setArticles(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    try {
      const article = await createArticle(title.trim(), content.trim(), level)
      setArticles(prev => [article, ...prev])
      setShowImport(false)
      setTitle('')
      setContent('')
      setLevel('')
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteArticle(id)
      setArticles(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleteId(null)
    }
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">読解</h1>
          <p className="text-xs text-gray-400 mt-0.5">日語精讀</p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
        >
          <Plus size={16} />
          导入文章
        </button>
      </div>

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setShowImport(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl flex flex-col max-h-[85dvh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">导入新文章</h2>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 px-5 py-4 space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">标题（选填）</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="文章标题"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-400"
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
                          : 'border-gray-200 text-gray-600'}`}
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
                  rows={7}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-jp
                    focus:outline-none focus:border-red-400 resize-none leading-relaxed"
                />
              </div>
            </div>
            <div className="px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100">
              <button
                onClick={handleSave}
                disabled={!content.trim() || saving}
                className="w-full py-3 bg-red-700 text-white rounded-xl font-medium
                  flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 size={18} className="animate-spin" />}
                保存文章
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Article list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">还没有文章</p>
          <p className="text-xs mt-1">点击「导入文章」开始精读</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map(article => (
            <div key={article.id} className="relative">
              {deleteId === article.id ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
                  <span className="text-sm text-red-700">确认删除「{article.title}」？</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteId(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg"
                    >取消</button>
                    <button
                      onClick={() => handleDelete(article.id)}
                      className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg"
                    >删除</button>
                  </div>
                </div>
              ) : (
                <Link
                  to={`/article/${article.id}`}
                  className="block bg-white border border-gray-200 rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">{article.title}</span>
                        {article.level && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${LEVEL_COLORS[article.level] || ''}`}>
                            {article.level}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-jp leading-relaxed line-clamp-2">
                        {article.content.slice(0, 80)}…
                      </p>
                      <p className="text-xs text-gray-300 mt-2">{formatDate(article.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={e => { e.preventDefault(); setDeleteId(article.id) }}
                        className="p-1.5 text-gray-300 hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                      <ChevronRight size={18} className="text-gray-300" />
                    </div>
                  </div>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
