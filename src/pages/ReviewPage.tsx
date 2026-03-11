import { useState, useEffect } from 'react'
import { RotateCcw, Check, Loader2, PartyPopper } from 'lucide-react'
import { getDueReviews, submitReview } from '../lib/db'
import type { ReviewRecord, Word, ReviewGrade } from '../types'
import WordDetailSheet from '../components/WordDetailSheet'
import type { WordInSentence } from '../types'

type ReviewItem = ReviewRecord & { word: Word }

const GRADE_BUTTONS: { grade: ReviewGrade; label: string; color: string }[] = [
  { grade: 0, label: '忘了', color: 'bg-red-100 text-red-700 border-red-200' },
  { grade: 1, label: '模糊', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { grade: 2, label: '记得', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { grade: 3, label: '很熟', color: 'bg-green-100 text-green-700 border-green-200' },
]

export default function ReviewPage() {
  const [queue, setQueue] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const items = await getDueReviews()
      setQueue(items)
      setTotal(items.length)
      setDone(0)
      setFlipped(false)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleGrade(grade: ReviewGrade) {
    const current = queue[0]
    if (!current) return
    setSubmitting(true)
    try {
      await submitReview(current.id, current.interval, current.ease_factor, grade)
      setQueue(prev => prev.slice(1))
      setDone(prev => prev + 1)
      setFlipped(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const current = queue[0]
  const progress = total > 0 ? (done / total) * 100 : 0

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    )
  }

  // All done
  if (total > 0 && queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
        <PartyPopper size={56} className="text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">今日复习完成！</h2>
        <p className="text-gray-500 text-sm">共复习了 {done} 个单词</p>
        <button onClick={load} className="mt-6 px-6 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">
          再次检查
        </button>
      </div>
    )
  }

  // Nothing due
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
        <Check size={56} className="text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">今天没有待复习单词</h2>
        <p className="text-gray-500 text-sm">先去阅读文章，把单词加入生词本吧</p>
        <button onClick={load} className="mt-6 px-6 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">
          <RotateCcw size={16} className="inline mr-1" />
          刷新
        </button>
      </div>
    )
  }

  function wordToWordInSentence(w: Word): WordInSentence {
    return { word: w.word, reading: w.reading, pos: w.pos, meaning: w.meaning }
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-gray-900">每日复习</h1>
          <span className="text-sm text-gray-400">{done} / {total}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-700 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {current && (
        <>
          {/* Card */}
          <div className="flex-1 flex flex-col justify-center">
            <button
              onClick={() => !flipped && setFlipped(true)}
              className={`w-full bg-white border-2 rounded-3xl p-8 text-center shadow-sm
                ${flipped ? 'border-gray-200' : 'border-gray-200 active:border-red-300'}`}
            >
              {/* Front: word */}
              <div className="font-jp text-4xl font-bold text-gray-900 mb-2" lang="ja">
                {current.word.word}
              </div>

              {!flipped && (
                <div className="text-sm text-gray-400 mt-4">点击翻转查看答案</div>
              )}

              {flipped && (
                <div className="mt-4 space-y-3 text-left">
                  <div className="h-px bg-gray-100" />
                  <div className="text-center">
                    <div className="text-xl text-gray-600 font-jp" lang="ja">{current.word.reading}</div>
                    <div className="text-xs text-gray-400 mt-1">{current.word.pos}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg text-gray-900 font-medium">{current.word.meaning}</div>
                  </div>
                  {current.word.details_cache?.examples?.[0] && (
                    <div className="bg-gray-50 rounded-xl p-3 mt-2">
                      <div className="font-jp text-sm text-gray-700" lang="ja">
                        {current.word.details_cache.examples[0].japanese}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {current.word.details_cache.examples[0].chinese}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setShowDetail(true) }}
                    className="text-xs text-red-700 underline w-full text-center mt-1"
                  >
                    查看详情
                  </button>
                </div>
              )}
            </button>
          </div>

          {/* Grade buttons */}
          {flipped && (
            <div className="mt-6 grid grid-cols-4 gap-2 pb-24">
              {GRADE_BUTTONS.map(({ grade, label, color }) => (
                <button
                  key={grade}
                  onClick={() => handleGrade(grade)}
                  disabled={submitting}
                  className={`py-3 rounded-xl border font-medium text-sm ${color} disabled:opacity-50`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {!flipped && (
            <div className="pb-24" />
          )}
        </>
      )}

      {showDetail && current && (
        <WordDetailSheet
          wordInfo={wordToWordInSentence(current.word)}
          articleId={current.word.article_id}
          existingWord={current.word}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  )
}
