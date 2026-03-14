import { useState, useEffect } from 'react'
import { BookMarked, Trash2, ChevronRight, Loader2 } from 'lucide-react'
import SwipeableRow from '../components/SwipeableRow'
import { getWords, deleteWord, getGrammars, deleteGrammar } from '../lib/db'
import type { Word, WordInSentence, SavedGrammar } from '../types'
import WordDetailSheet from '../components/WordDetailSheet'
import GrammarDetailSheet from '../components/GrammarDetailSheet'

type Tab = 'words' | 'grammar'

export default function VocabPage() {
  const [tab, setTab] = useState<Tab>('words')
  const [words, setWords] = useState<Word[]>([])
  const [grammars, setGrammars] = useState<SavedGrammar[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [selectedGrammar, setSelectedGrammar] = useState<SavedGrammar | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">收藏</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{words.length} 个单词 · {grammars.length} 个语法</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-[#2a2a2a] rounded-xl p-1 mb-4">
        <button
          onClick={() => setTab('words')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === 'words' ? 'bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
        >
          单词
        </button>
        <button
          onClick={() => setTab('grammar')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === 'grammar' ? 'bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
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
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-sm text-red-700">删除「{word.word}」？</span>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#333] rounded-lg">取消</button>
                      <button onClick={() => handleDeleteWord(word.id)} className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg">删除</button>
                    </div>
                  </div>
                ) : (
                  <SwipeableRow
                    onSwipeLeft={() => setDeleteId(word.id)}
                    leftAction={{ bg: 'bg-red-500', icon: <Trash2 size={20} className="text-white" /> }}
                  >
                    <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] px-4 py-3 flex items-center gap-3">
                      <button onClick={() => setSelectedWord(word)} className="flex-1 text-left flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-jp font-medium text-gray-900 dark:text-gray-100" lang="ja">{word.word}</span>
                            <span className="text-gray-400 dark:text-gray-500 text-sm" lang="ja">{word.reading}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#2a2a2a] rounded px-1.5 py-0.5 shrink-0">{word.pos}</span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 truncate">{word.meaning}</div>
                        </div>
                        <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
                      </button>
                    </div>
                  </SwipeableRow>
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
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-sm text-red-700">删除「{g.pattern}」？</span>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#333] rounded-lg">取消</button>
                      <button onClick={() => handleDeleteGrammar(g.id)} className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg">删除</button>
                    </div>
                  </div>
                ) : (
                  <SwipeableRow
                    onSwipeLeft={() => setDeleteId(g.id)}
                    leftAction={{ bg: 'bg-red-500', icon: <Trash2 size={20} className="text-white" /> }}
                  >
                    <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] px-4 py-3 flex items-center gap-3">
                      <button onClick={() => setSelectedGrammar(g)} className="flex-1 text-left flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-jp font-medium text-amber-900 dark:text-amber-300" lang="ja">{g.pattern}</span>
                            {g.jlpt && (
                              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium shrink-0">{g.jlpt}</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{g.meaning}</div>
                          {g.usage && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{g.usage}</div>}
                        </div>
                        <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
                      </button>
                    </div>
                  </SwipeableRow>
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

      {selectedGrammar && (
        <GrammarDetailSheet
          grammar={selectedGrammar}
          onClose={() => setSelectedGrammar(null)}
        />
      )}
    </div>
  )
}
