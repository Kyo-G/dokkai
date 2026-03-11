import { useState, useEffect } from 'react'
import { BookMarked, Trash2, ChevronRight, Loader2, Download } from 'lucide-react'
import { getWords, deleteWord, getGrammars, deleteGrammar } from '../lib/db'
import type { Word, WordInSentence, SavedGrammar } from '../types'
import WordDetailSheet from '../components/WordDetailSheet'
import { isAudioCached, fetchTTS, storeBlob } from '../lib/audioCache'

type Tab = 'words' | 'grammar'

export default function VocabPage() {
  const [tab, setTab] = useState<Tab>('words')
  const [words, setWords] = useState<Word[]>([])
  const [grammars, setGrammars] = useState<SavedGrammar[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [caching, setCaching] = useState(false)
  const [cacheProgress, setCacheProgress] = useState<{done: number, total: number} | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [w, g] = await Promise.all([getWords(), getGrammars()])
      setWords(w)
      setGrammars(g)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteWord(id: string) {
    try {
      await deleteWord(id)
      setWords(prev => prev.filter(w => w.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleteId(null)
    }
  }

  async function handleDeleteGrammar(id: string) {
    try {
      await deleteGrammar(id)
      setGrammars(prev => prev.filter(g => g.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleteId(null)
    }
  }

  function wordToWordInSentence(w: Word): WordInSentence {
    return { word: w.word, reading: w.reading, pos: w.pos, meaning: w.meaning }
  }

  async function handleCacheAll() {
    const uncached: string[] = []
    for (const w of words) {
      if (!(await isAudioCached(w.word))) uncached.push(w.word)
    }
    if (uncached.length === 0) return
    setCaching(true)
    setCacheProgress({ done: 0, total: uncached.length })
    for (let i = 0; i < uncached.length; i++) {
      try {
        const blob = await fetchTTS(uncached[i])
        await storeBlob(uncached[i], blob)
      } catch { /* skip on error */ }
      setCacheProgress({ done: i + 1, total: uncached.length })
    }
    setCaching(false)
    setCacheProgress(null)
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">收藏</h1>
          <p className="text-xs text-gray-400 mt-0.5">{words.length} 个单词 · {grammars.length} 个语法</p>
        </div>
        {tab === 'words' && words.length > 0 && (
          <button
            onClick={handleCacheAll}
            disabled={caching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 disabled:opacity-50"
          >
            {caching
              ? <><Loader2 size={14} className="animate-spin" />{cacheProgress ? `${cacheProgress.done}/${cacheProgress.total}` : '…'}</>
              : <><Download size={14} />缓存读音</>
            }
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setTab('words')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === 'words' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          单词
        </button>
        <button
          onClick={() => setTab('grammar')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === 'grammar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          语法
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : tab === 'words' ? (
        words.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookMarked size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">单词本是空的</p>
            <p className="text-xs mt-1">在文章阅读时点击单词加入</p>
          </div>
        ) : (
          <div className="space-y-2 pb-24">
            {words.map(word => (
              <div key={word.id}>
                {deleteId === word.id ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-sm text-red-700">删除「{word.word}」？</span>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg">取消</button>
                      <button onClick={() => handleDeleteWord(word.id)} className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg">删除</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <button onClick={() => setSelectedWord(word)} className="flex-1 text-left flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-jp font-medium text-gray-900" lang="ja">{word.word}</span>
                          <span className="text-gray-400 text-sm" lang="ja">{word.reading}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">{word.pos}</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-0.5 truncate">{word.meaning}</div>
                        {word.article_title && (
                          <div className="text-xs text-gray-300 mt-0.5 truncate">来自：{word.article_title}</div>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-gray-300 shrink-0" />
                    </button>
                    <button onClick={() => setDeleteId(word.id)} className="p-1.5 text-gray-300 hover:text-red-400 shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        grammars.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookMarked size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">语法收藏是空的</p>
            <p className="text-xs mt-1">在句子分析时点击语法点右侧的书签加入</p>
          </div>
        ) : (
          <div className="space-y-2 pb-24">
            {grammars.map(g => (
              <div key={g.id}>
                {deleteId === g.id ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-sm text-red-700">删除「{g.pattern}」？</span>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg">取消</button>
                      <button onClick={() => handleDeleteGrammar(g.id)} className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg">删除</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-jp font-medium text-amber-900" lang="ja">{g.pattern}</span>
                        {g.jlpt && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0">{g.jlpt}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 mt-0.5">{g.meaning}</div>
                      {g.usage && <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{g.usage}</div>}
                      {g.article_title && (
                        <div className="text-xs text-gray-300 mt-0.5 truncate">来自：{g.article_title}</div>
                      )}
                    </div>
                    <button onClick={() => setDeleteId(g.id)} className="p-1.5 text-gray-300 hover:text-red-400 shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {selectedWord && (
        <WordDetailSheet
          wordInfo={wordToWordInSentence(selectedWord)}
          articleId={selectedWord.article_id}
          existingWord={selectedWord}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  )
}
