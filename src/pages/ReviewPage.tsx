import { useState, useEffect } from 'react'
import { RotateCcw, Check, Loader2, Volume2, Square } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getDueReviews, submitReview, submitGrammarReview, getUserExamplesForWord, type UserSentenceExample } from '../lib/db'
import type { AnyReviewItem } from '../lib/db'
import type { ReviewGrade } from '../types'
import WordDetailSheet from '../components/WordDetailSheet'
import type { WordInSentence } from '../types'
import { useSpeech } from '../hooks/useSpeech'
import { useSettings } from '../hooks/useSettings'
import { getT } from '../lib/i18n'

type UserExample = UserSentenceExample

export default function ReviewPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const t = getT(settings.language)
  const [queue, setQueue] = useState<AnyReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [gradeMap, setGradeMap] = useState<Record<number, number>>({ 0: 0, 1: 0, 2: 0, 3: 0 })
  const [showDetail, setShowDetail] = useState(false)
  const [userExamples, setUserExamples] = useState<UserExample[] | null>(null)
  const { speak, stop, speaking } = useSpeech()

  const GRADE_BUTTONS: { grade: ReviewGrade; label: string; color: string; emoji: string }[] = [
    { grade: 0, label: t.forgot,    color: 'bg-red-100 text-red-700 border-red-200 active:bg-red-200',    emoji: '😣' },
    { grade: 1, label: t.vague,     color: 'bg-orange-100 text-orange-700 border-orange-200 active:bg-orange-200', emoji: '🤔' },
    { grade: 2, label: t.remember,  color: 'bg-blue-100 text-blue-700 border-blue-200 active:bg-blue-200',  emoji: '😊' },
    { grade: 3, label: t.mastered,  color: 'bg-green-100 text-green-700 border-green-200 active:bg-green-200',  emoji: '🎯' },
  ]

  useEffect(() => { load() }, [])

  // Fetch user's own sentences containing this word when the card is flipped
  useEffect(() => {
    const current = queue[0]
    if (!flipped || !current || current.type !== 'word') {
      setUserExamples(null)
      return
    }
    const word = (current as Extract<AnyReviewItem, { type: 'word' }>).word.word
    setUserExamples(null)
    getUserExamplesForWord(word)
      .then(setUserExamples)
      .catch(() => setUserExamples([]))
  }, [flipped, done])

  async function load() {
    setLoading(true)
    try {
      const items = await getDueReviews()
      setQueue(items)
      setTotal(items.length)
      setDone(0)
      setFlipped(false)
      setExiting(false)
      setGradeMap({ 0: 0, 1: 0, 2: 0, 3: 0 })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleGrade(grade: ReviewGrade) {
    const current = queue[0]
    if (!current || submitting || exiting) return

    setExiting(true)
    await new Promise(r => setTimeout(r, 220))

    setSubmitting(true)
    try {
      if (current.type === 'word') {
        await submitReview(current.id, current.interval, current.ease_factor, grade)
      } else {
        await submitGrammarReview(current.id, current.interval, current.ease_factor, grade)
      }
      setGradeMap(prev => ({ ...prev, [grade]: (prev[grade] ?? 0) + 1 }))
      setQueue(prev => prev.slice(1))
      setDone(prev => prev + 1)
      setFlipped(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : t.vague)
    } finally {
      setSubmitting(false)
      setExiting(false)
    }
  }

  const current = queue[0]
  const progress = total > 0 ? (done / total) * 100 : 0

  const barColor =
    progress >= 80 ? 'bg-green-500' :
    progress >= 40 ? 'bg-amber-500' :
    'bg-red-700'

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    )
  }

  // ── Completion screen ──
  if (total > 0 && queue.length === 0) {
    const perfect = gradeMap[0] === 0 && gradeMap[1] === 0
    const strong  = (gradeMap[2] + gradeMap[3]) / total >= 0.8
    const message = perfect ? t.reviewCompletePerfect : strong ? t.reviewCompleteStrong : t.reviewCompleteOk

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
        <div className="text-7xl mb-5 animate-bounce-in select-none">
          {perfect ? '🏆' : strong ? '🎉' : '💪'}
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t.reviewComplete}</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">{message}</p>

        {/* Grade breakdown */}
        <div className="grid grid-cols-4 gap-2 w-full max-w-xs mb-8">
          {GRADE_BUTTONS.map(({ grade, label, emoji, color }) => (
            gradeMap[grade] > 0 ? (
              <div key={grade} className={`flex flex-col items-center rounded-2xl py-3 px-1 border ${color}`}>
                <span className="text-xl mb-0.5">{emoji}</span>
                <span className="text-lg font-bold leading-none">{gradeMap[grade]}</span>
                <span className="text-[11px] mt-0.5 opacity-80">{label}</span>
              </div>
            ) : (
              <div key={grade} className="flex flex-col items-center rounded-2xl py-3 px-1 border border-gray-100 dark:border-[#2a2a2a] opacity-30">
                <span className="text-xl mb-0.5">{emoji}</span>
                <span className="text-lg font-bold leading-none text-gray-400">0</span>
                <span className="text-[11px] mt-0.5 text-gray-400">{label}</span>
              </div>
            )
          ))}
        </div>

        <button
          onClick={load}
          className="px-6 py-2.5 border border-gray-200 dark:border-[#333] rounded-xl text-sm text-gray-600 dark:text-gray-400"
        >
          {t.reviewAgain}
        </button>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
        <Check size={56} className="text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t.noReviewToday}</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{t.noReviewHint}</p>
        <button onClick={load} className="mt-6 px-6 py-2.5 border border-gray-200 dark:border-[#333] rounded-xl text-sm text-gray-600 dark:text-gray-400">
          <RotateCcw size={16} className="inline mr-1" />{t.refresh}
        </button>
      </div>
    )
  }

  const isWord    = current?.type === 'word'
  const isGrammar = current?.type === 'grammar'

  function wordToWordInSentence(): WordInSentence | null {
    if (!current || !isWord) return null
    const w = (current as Extract<AnyReviewItem, { type: 'word' }>).word
    return { word: w.word, reading: w.reading, pos: w.pos, meaning: w.meaning }
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto flex flex-col min-h-[calc(100dvh-4rem)]">
      {/* Header + Progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.dailyReview}</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-400 dark:text-gray-500 tabular-nums">
              {done} / {total}
            </span>
            {progress > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                progress >= 80 ? 'bg-green-100 text-green-700' :
                progress >= 40 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {Math.round(progress)}%
              </span>
            )}
          </div>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-right">
          {t.remaining(queue.length)}
        </p>
      </div>

      {current && (
        <>
          <div className="flex-1 flex flex-col justify-center">
            <button
              key={done}
              onClick={() => !flipped && !exiting && setFlipped(true)}
              className={`w-full bg-white dark:bg-[#1e1e1e] border-2 rounded-3xl p-8 text-center shadow-sm
                ${flipped ? 'border-gray-300 dark:border-[#444]' : 'border-gray-200 dark:border-[#333]'}
                ${exiting ? 'animate-card-leave' : 'animate-card-arrive'}`}
            >
              {/* Type badge */}
              <div className="mb-4">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  isWord ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                }`}>
                  {isWord ? t.wordBadge : t.grammarBadge}
                </span>
              </div>

              {/* Front: key item */}
              {isWord && (
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="font-jp text-4xl font-bold text-gray-900 dark:text-gray-100" lang="ja">
                    {(current as Extract<AnyReviewItem, { type: 'word' }>).word.word}
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      speaking ? stop() : speak((current as Extract<AnyReviewItem, { type: 'word' }>).word.word)
                    }}
                    className="text-gray-400 dark:text-gray-500 active:text-red-600"
                  >
                    {speaking ? <Square size={16} fill="currentColor" /> : <Volume2 size={20} />}
                  </button>
                </div>
              )}
              {isGrammar && (
                <div className="font-jp text-3xl font-bold text-amber-900 dark:text-amber-300 mb-2" lang="ja">
                  {(current as Extract<AnyReviewItem, { type: 'grammar' }>).grammar.pattern}
                </div>
              )}

              {!flipped && (
                <div className="text-sm text-gray-400 dark:text-gray-500 mt-4">{t.tapToFlip}</div>
              )}

              {/* Answer panel */}
              {flipped && (
                <div className="mt-4 space-y-3 text-left animate-flip-answer">
                  <div className="h-px bg-gray-100 dark:bg-[#2a2a2a]" />

                  {isWord && (() => {
                    const w = (current as Extract<AnyReviewItem, { type: 'word' }>).word
                    return (
                      <>
                        <div className="text-center">
                          <div className="text-xl text-gray-600 dark:text-gray-400 font-jp" lang="ja">{w.reading}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{w.pos}</div>
                        </div>
                        <div className="text-center text-lg text-gray-900 dark:text-gray-100 font-medium">{w.meaning}</div>
                        {/* User's own read sentences */}
                        {userExamples === null && (
                          <div className="flex justify-center py-1">
                            <Loader2 size={13} className="animate-spin text-gray-300 dark:text-gray-600" />
                          </div>
                        )}
                        {userExamples && userExamples.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">{t.readSentences}</div>
                            {userExamples.map((ex, i) => (
                              <button
                                key={i}
                                onClick={e => { e.stopPropagation(); navigate(`/article/${ex.articleId}?sentence=${ex.sentenceId}`) }}
                                className="w-full text-left bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3"
                              >
                                <div className="font-jp text-sm text-gray-700 dark:text-gray-300 leading-relaxed" lang="ja">{ex.content}</div>
                                <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">— {ex.articleTitle}</div>
                              </button>
                            ))}
                          </div>
                        )}
                        {/* AI example as fallback */}
                        {userExamples?.length === 0 && w.details_cache?.examples?.[0] && (
                          <div className="bg-gray-50 dark:bg-[#252525] rounded-xl p-3">
                            <div className="font-jp text-sm text-gray-700 dark:text-gray-300" lang="ja">{w.details_cache.examples[0].japanese}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{w.details_cache.examples[0].chinese}</div>
                          </div>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); setShowDetail(true) }}
                          className="text-xs text-red-700 underline w-full text-center mt-1"
                        >
                          {t.viewDetails}
                        </button>
                      </>
                    )
                  })()}

                  {isGrammar && (() => {
                    const g = (current as Extract<AnyReviewItem, { type: 'grammar' }>).grammar
                    return (
                      <>
                        <div className="text-center text-lg text-gray-900 dark:text-gray-100 font-medium">{g.meaning}</div>
                        {g.usage && (
                          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-sm text-gray-700 dark:text-gray-300 text-left">{g.usage}</div>
                        )}
                        {g.jlpt && (
                          <div className="text-center">
                            <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">{g.jlpt}</span>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </button>
          </div>

          {/* Grade buttons */}
          {flipped && (
            <div className="mt-6 grid grid-cols-4 gap-2 pb-24 animate-fade-in-down">
              {GRADE_BUTTONS.map(({ grade, label, color, emoji }) => (
                <button
                  key={grade}
                  onClick={() => handleGrade(grade)}
                  disabled={submitting || exiting}
                  className={`py-3 rounded-xl border font-medium text-sm flex flex-col items-center gap-0.5 ${color} disabled:opacity-40 transition-opacity`}
                >
                  <span className="text-base leading-none">{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
          {!flipped && <div className="pb-24" />}
        </>
      )}

      {showDetail && current?.type === 'word' && wordToWordInSentence() && (
        <WordDetailSheet
          wordInfo={wordToWordInSentence()!}
          articleId={(current as Extract<AnyReviewItem, { type: 'word' }>).word.article_id}
          existingWord={(current as Extract<AnyReviewItem, { type: 'word' }>).word}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  )
}
