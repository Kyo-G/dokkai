import { useState, useEffect } from 'react'
import { BookMarked, Trash2, ChevronRight, Loader2 } from 'lucide-react'
import { getWords, deleteWord } from '../lib/db'
import type { Word, WordInSentence } from '../types'
import WordDetailSheet from '../components/WordDetailSheet'

export default function VocabPage() {
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await getWords()
      setWords(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWord(id)
      setWords(prev => prev.filter(w => w.id !== id))
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">生词本</h1>
        <p className="text-xs text-gray-400 mt-0.5">共 {words.length} 个单词</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : words.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookMarked size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">生词本是空的</p>
          <p className="text-xs mt-1">在文章阅读时点击单词加入生词本</p>
        </div>
      ) : (
        <div className="space-y-2">
          {words.map(word => (
            <div key={word.id}>
              {deleteId === word.id ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
                  <span className="text-sm text-red-700">删除「{word.word}」？</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteId(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg"
                    >取消</button>
                    <button
                      onClick={() => handleDelete(word.id)}
                      className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg"
                    >删除</button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <button
                    onClick={() => setSelectedWord(word)}
                    className="flex-1 text-left flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-jp font-medium text-gray-900">{word.word}</span>
                        <span className="text-gray-400 text-sm">{word.reading}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">{word.pos}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-0.5 truncate">{word.meaning}</div>
                      {word.article_title && (
                        <div className="text-xs text-gray-300 mt-0.5 truncate">来自：{word.article_title}</div>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                  <button
                    onClick={() => setDeleteId(word.id)}
                    className="p-1.5 text-gray-300 hover:text-red-400 shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
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
