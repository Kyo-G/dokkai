import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, BookmarkPlus, Check } from 'lucide-react'
import type { Sentence, SentenceAnalysis, WordInSentence, GrammarPoint } from '../types'
import { analyzeSentence } from '../lib/ai'
import { saveSentenceAnalysis, addGrammar } from '../lib/db'
import { useSettings } from '../hooks/useSettings'
import WordDetailSheet from './WordDetailSheet'

const ROLE_COLORS: Record<string, string> = {
  '主语': 'bg-blue-100 text-blue-800',
  '谓语': 'bg-red-100 text-red-800',
  '宾语': 'bg-green-100 text-green-800',
  '修饰成分': 'bg-yellow-100 text-yellow-800',
  '补语': 'bg-purple-100 text-purple-800',
  '连词': 'bg-gray-100 text-gray-600',
  '助词': 'bg-gray-100 text-gray-500',
}

function roleColor(role: string): string {
  for (const key of Object.keys(ROLE_COLORS)) {
    if (role.includes(key)) return ROLE_COLORS[key]
  }
  return 'bg-gray-100 text-gray-600'
}

interface Props {
  sentence: Sentence
  articleId: string
  onAnalyzed: (id: string, analysis: SentenceAnalysis) => void
}

export default function SentenceItem({ sentence, articleId, onAnalyzed }: Props) {
  const { settings } = useSettings()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<SentenceAnalysis | null>(sentence.analysis_cache)
  const [selectedWord, setSelectedWord] = useState<WordInSentence | null>(null)
  const [savedGrammars, setSavedGrammars] = useState<Set<string>>(new Set())
  const [savingGrammar, setSavingGrammar] = useState<string | null>(null)

  async function handleExpand() {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (analysis) return

    setLoading(true)
    setError('')
    try {
      const result = await analyzeSentence(settings, sentence.content)
      setAnalysis(result)
      await saveSentenceAnalysis(sentence.id, result)
      onAnalyzed(sentence.id, result)
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析失败，请重试')
      setExpanded(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveGrammar(g: GrammarPoint) {
    const key = g.pattern
    setSavingGrammar(key)
    try {
      await addGrammar(g.pattern, g.meaning, g.usage, g.jlpt || '', articleId)
      setSavedGrammars(prev => new Set(prev).add(key))
    } catch (e) {
      if (e instanceof Error && e.message.includes('已在收藏')) {
        setSavedGrammars(prev => new Set(prev).add(key))
      } else {
        alert(e instanceof Error ? e.message : '收藏失败')
      }
    } finally {
      setSavingGrammar(null)
    }
  }

  return (
    <>
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
        {/* Sentence row */}
        <button
          onClick={handleExpand}
          className="w-full text-left px-4 py-4 flex items-start gap-3"
        >
          <div className="font-jp text-base leading-relaxed text-gray-900 flex-1" lang="ja">
            {sentence.content}
          </div>
          <div className="mt-1 shrink-0 text-gray-400">
            {loading
              ? <Loader2 size={18} className="animate-spin" />
              : expanded
                ? <ChevronUp size={18} />
                : <ChevronDown size={18} />
            }
          </div>
        </button>

        {/* Error */}
        {error && (
          <div className="px-4 pb-3 text-sm text-red-600">{error}</div>
        )}

        {/* Analysis panel */}
        {expanded && analysis && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-5">
            {/* Structure */}
            {analysis.structure?.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">句子结构</div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.structure.map((part, i) => (
                    <span
                      key={i}
                      className={`inline-flex flex-col items-center rounded-lg px-2 py-1 ${roleColor(part.role)}`}
                    >
                      <span className="font-jp text-sm font-medium" lang="ja">{part.text}</span>
                      <span className="text-[10px] opacity-70 mt-0.5">{part.role}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Grammar */}
            {analysis.grammar?.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">语法点</div>
                <div className="space-y-2">
                  {analysis.grammar.map((g, i) => {
                    const saved = savedGrammars.has(g.pattern)
                    const saving = savingGrammar === g.pattern
                    return (
                      <div key={i} className="bg-amber-50 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-jp font-bold text-amber-900" lang="ja">{g.pattern}</span>
                            {g.jlpt && (
                              <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                                {g.jlpt}
                              </span>
                            )}
                            <span className="text-amber-700 text-sm">— {g.meaning}</span>
                          </div>
                          <button
                            onClick={() => !saved && handleSaveGrammar(g)}
                            className="shrink-0 mt-0.5"
                            disabled={saving}
                          >
                            {saving
                              ? <Loader2 size={15} className="animate-spin text-amber-400" />
                              : saved
                                ? <Check size={15} className="text-green-600" />
                                : <BookmarkPlus size={15} className="text-amber-400" />
                            }
                          </button>
                        </div>
                        <div className="text-gray-600 text-sm">{g.usage}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Words */}
            {analysis.words?.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">单词列表</div>
                <div className="space-y-1">
                  {analysis.words.map((w, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedWord(w)}
                      className="w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 active:bg-gray-100"
                    >
                      <span className="font-jp text-base font-medium text-gray-900 w-20 shrink-0" lang="ja">{w.word}</span>
                      <span className="text-gray-400 text-sm w-20 shrink-0" lang="ja">{w.reading}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">{w.pos}</span>
                      <span className="text-gray-700 text-sm flex-1 truncate">{w.meaning}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedWord && (
        <WordDetailSheet
          wordInfo={selectedWord}
          articleId={articleId}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </>
  )
}
