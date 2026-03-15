import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Loader2, BookmarkPlus, Volume2, Square, RefreshCw } from 'lucide-react'
import type { Sentence, SentenceAnalysis, WordInSentence, GrammarPoint, StructurePart } from '../types'
import { analyzeSentence, generateFurigana } from '../lib/ai'
import { tokenizeSentence } from '../lib/tokenizer'
import { saveSentenceAnalysis, addGrammar, addWord } from '../lib/db'
import { useSettings } from '../hooks/useSettings'
import { useSpeech } from '../hooks/useSpeech'
import WordDetailSheet from './WordDetailSheet'
import GrammarDetailSheet from './GrammarDetailSheet'
import Furigana from './Furigana'
import { vocabCardClass } from './VocabText'
import SwipeableRow from './SwipeableRow'
import { getT } from '../lib/i18n'

const JLPT_RANK: Record<string, number> = { N5: 5, N4: 4, N3: 3, N2: 2, N1: 1 }

// Returns true if the word should be visible given the user's level
function isWordVisible(wordJlpt: string | undefined, userLevel: string): boolean {
  if (!userLevel) return true           // no filter set
  if (!wordJlpt) return true            // unknown level → always show
  const wordRank = JLPT_RANK[wordJlpt]
  const userRank = JLPT_RANK[userLevel]
  if (!wordRank || !userRank) return true
  return wordRank <= userRank           // show only words harder than user level
}

const ROLE_COLORS: Record<string, string> = {
  '主语':   'bg-blue-100   text-blue-800   dark:bg-blue-950/40   dark:text-blue-300',
  'Subject':'bg-blue-100   text-blue-800   dark:bg-blue-950/40   dark:text-blue-300',
  '谓语':   'bg-red-100    text-red-800    dark:bg-red-950/40    dark:text-red-300',
  'Predicate':'bg-red-100  text-red-800    dark:bg-red-950/40    dark:text-red-300',
  '宾语':   'bg-green-100  text-green-800  dark:bg-green-950/40  dark:text-green-300',
  'Object': 'bg-green-100  text-green-800  dark:bg-green-950/40  dark:text-green-300',
  '修饰':   'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
  'Modifier':'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
  '从句':   'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
  'Clause': 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
  '动词':   'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  'Verb':   'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
}

function roleColor(role: string): string {
  for (const key of Object.keys(ROLE_COLORS)) {
    if (role.includes(key)) return ROLE_COLORS[key]
  }
  return 'bg-gray-100 text-gray-600 dark:bg-[#2a2a2a] dark:text-gray-400'
}

const CORE_ROLES = ['主语', '谓语', '宾语', 'Subject', 'Predicate', 'Object']
function hasCoreRole(children: StructurePart[]): boolean {
  return children.some(c => CORE_ROLES.some(r => c.role.includes(r)))
}

function StructureNode({ part, depth }: { part: StructurePart; depth: number }) {
  const [open, setOpen] = useState(false)
  const expandable = !!(part.children?.length && hasCoreRole(part.children))
  return (
    <div style={{ marginLeft: depth * 12 }}>
      <div
        className={`inline-flex flex-col rounded-lg px-2 py-1 mb-1 ${roleColor(part.role)} ${expandable ? 'cursor-pointer select-none' : ''}`}
        onClick={expandable ? () => setOpen(v => !v) : undefined}
      >
        <span className="text-[9px] opacity-60 leading-none mb-0.5">
          {part.role}{expandable ? (open ? ' ▲' : ' ▼') : ''}
        </span>
        <span className="font-jp text-sm font-medium leading-snug" lang="ja">{part.text}</span>
      </div>
      {expandable && open && (
        <div className="border-l-2 border-gray-200 dark:border-[#333] ml-2 pl-2 mb-1">
          {part.children!.map((child, i) => (
            <StructureNode key={i} part={child} depth={0} />
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  sentence: Sentence
  articleId: string
  onAnalyzed: (id: string, analysis: SentenceAnalysis) => void
  onExpand?: (sentenceId: string | null, content: string | null) => void
  showFurigana?: boolean
  isRead?: boolean
  onRead?: () => void
  vocabIndex?: Map<string, number>
}

export default function SentenceItem({ sentence, articleId, onAnalyzed, onExpand, showFurigana, isRead, onRead, vocabIndex }: Props) {
  const { settings } = useSettings()
  const t = getT(settings.language)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<SentenceAnalysis | null>(sentence.analysis_cache)
  const [selectedWord, setSelectedWord] = useState<WordInSentence | null>(null)
  const [selectedGrammar, setSelectedGrammar] = useState<GrammarPoint | null>(null)
  const { speak, stop, speaking } = useSpeech()
  const [savedGrammars, setSavedGrammars] = useState<Set<string>>(new Set())
  const [savingGrammar, setSavingGrammar] = useState<string | null>(null)
  const [savedWords, setSavedWords] = useState<Set<string>>(() => new Set(vocabIndex?.keys()))
  const [savingWord, setSavingWord] = useState<string | null>(null)
  const [showHiddenGrammar, setShowHiddenGrammar] = useState(false)
  const [showHiddenWords, setShowHiddenWords] = useState(false)

  // If a sentence was analyzed before kuromoji was introduced, words may be missing.
  // Re-tokenize automatically when the panel is expanded and words are absent.
  useEffect(() => {
    if (!expanded || !analysis || (analysis.words && analysis.words.length > 0)) return
    tokenizeSentence(sentence.content, settings.language)
      .then(words => {
        if (words.length === 0) return
        const furigana = analysis.furigana || generateFurigana(sentence.content, words)
        const updated = { ...analysis, words, furigana }
        setAnalysis(updated)
        saveSentenceAnalysis(sentence.id, updated).catch(() => {})
        onAnalyzed(sentence.id, updated)
      })
      .catch(() => {})
  }, [expanded])

  async function runAnalysis() {
    setLoading(true)
    setError('')
    try {
      const result = await analyzeSentence(settings, sentence.content)
      setAnalysis(result)
      await saveSentenceAnalysis(sentence.id, result)
      onAnalyzed(sentence.id, result)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.analysisFailed)
    } finally {
      setLoading(false)
    }
  }

  async function handleExpand() {
    if (expanded) {
      setExpanded(false)
      onExpand?.(null, null)
      return
    }
    setExpanded(true)
    onExpand?.(sentence.id, sentence.content)
    onRead?.()
    if (analysis) return
    await runAnalysis()
  }

  async function handleQuickSaveWord(w: WordInSentence) {
    setSavingWord(w.word)
    try {
      await addWord(w.word, w.reading, w.pos, w.meaning, articleId, sentence.id)
      setSavedWords(prev => new Set(prev).add(w.word))
    } catch (e) {
      if (e instanceof Error && e.message.includes('已在生词本')) {
        setSavedWords(prev => new Set(prev).add(w.word))
      } else {
        alert(e instanceof Error ? e.message : '收藏失败')
      }
    } finally {
      setSavingWord(null)
    }
  }

  async function handleSaveGrammar(g: GrammarPoint) {
    const key = g.pattern
    setSavingGrammar(key)
    try {
      await addGrammar(g.pattern, g.meaning, g.usage, g.jlpt || '', articleId, sentence.id)
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
      <div className={`border rounded-2xl overflow-hidden bg-white dark:bg-[#1e1e1e] flex ${
        isRead
          ? 'border-gray-200 dark:border-[#333]'
          : 'border-gray-200 dark:border-[#333]'
      }`}>
        {/* Read indicator bar */}
        <div className={`w-1 shrink-0 transition-colors duration-500 ${isRead ? 'bg-green-400 dark:bg-green-600' : 'bg-transparent'}`} />
        <div className="flex-1 min-w-0">
        {/* Sentence row */}
        <div className="px-4 py-4 flex items-start gap-3">
          <button onClick={handleExpand} className="flex-1 text-left flex items-start gap-3">
            <div className="font-jp text-base text-gray-900 dark:text-gray-100 flex-1" lang="ja">
              {showFurigana && analysis?.furigana
                ? <Furigana text={analysis.furigana} className="leading-loose" />
                : <span className="leading-relaxed">{sentence.content}</span>
              }
            </div>
            <div className="mt-1 shrink-0 text-gray-400 dark:text-gray-500">
              {loading
                ? <Loader2 size={18} className="animate-spin" />
                : expanded
                  ? <ChevronUp size={18} />
                  : <ChevronDown size={18} />
              }
            </div>
          </button>
          <button
            onClick={e => { e.stopPropagation(); speaking ? stop() : speak(sentence.content) }}
            className="mt-1 shrink-0 text-gray-400 dark:text-gray-500 active:text-red-600"
          >
            {speaking ? <Square size={16} fill="currentColor" /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 pb-3 text-sm text-red-600">{error}</div>
        )}

        {/* Analysis panel */}
        {expanded && analysis && (
          <div className="border-t border-gray-100 dark:border-[#2a2a2a] px-4 py-4 space-y-5 animate-fade-in-down">
            {/* Re-analyze button */}
            <div className="flex justify-end">
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 active:text-gray-600 disabled:opacity-40"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                {t.reanalyze}
              </button>
            </div>

            {/* Structure */}
            {analysis.structure?.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide mb-2">{t.sentenceStructure}</div>
                <div>
                  {analysis.structure.map((part, i) => (
                    <StructureNode key={i} part={part} depth={0} />
                  ))}
                </div>
              </div>
            )}

            {/* Grammar */}
            {analysis.grammar?.length > 0 && (() => {
              const visibleGrammar = analysis.grammar.filter(g => isWordVisible(g.jlpt, settings.userLevel))
              const hiddenGrammar = analysis.grammar.filter(g => !isWordVisible(g.jlpt, settings.userLevel))
              const displayGrammar = showHiddenGrammar ? analysis.grammar : visibleGrammar
              return (
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide mb-2 flex items-center gap-2">
                    {t.grammarPoints}
                    {hiddenGrammar.length > 0 && (
                      <button
                        onClick={() => setShowHiddenGrammar(v => !v)}
                        className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#333] rounded px-1.5 py-0.5 font-normal"
                      >
                        {showHiddenGrammar ? t.collapseSimpleGrammar : t.hiddenGrammarCount(hiddenGrammar.length)}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {displayGrammar.map((g, i) => {
                      const saved = savedGrammars.has(g.pattern)
                      const saving = savingGrammar === g.pattern
                      const isHidden = !isWordVisible(g.jlpt, settings.userLevel)
                      return (
                        <SwipeableRow
                          key={i}
                          onSwipeRight={saved ? undefined : () => handleSaveGrammar(g)}
                          rightAction={saved ? undefined : { bg: 'bg-green-500', icon: <BookmarkPlus size={20} className="text-white" /> }}
                        >
                          <div
                            className={`rounded-xl p-3 cursor-pointer ${isHidden ? 'opacity-40' : ''} ${saved ? 'bg-green-50 dark:bg-green-950/20' : 'bg-amber-50 dark:bg-amber-950/30 active:bg-amber-100 dark:active:bg-amber-900/40'}`}
                            onClick={() => setSelectedGrammar(g)}
                          >
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-jp font-bold text-amber-900 dark:text-amber-300" lang="ja">{g.pattern}</span>
                              {g.jlpt && (
                                <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                                  {g.jlpt}
                                </span>
                              )}
                              {saving && <Loader2 size={13} className="animate-spin text-amber-400 ml-auto" />}
                              <span className="text-amber-700 dark:text-amber-400 text-sm">— {g.meaning}</span>
                            </div>
                            <div className="text-gray-600 dark:text-gray-400 text-sm">{g.usage}</div>
                          </div>
                        </SwipeableRow>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Words */}
            {analysis.words?.length > 0 && (() => {
              const isPunct = (w: { word: string }) => !/[\u3040-\u9fff\uff21-\uff3a\uff41-\uff5a\u0041-\u007a]/.test(w.word)
              const nonPunct = analysis.words.filter(w => !isPunct(w) && w.meaning)
              const visible = nonPunct.filter(w => isWordVisible(w.jlpt, settings.userLevel))
              const hidden = nonPunct.filter(w => !isWordVisible(w.jlpt, settings.userLevel))
              const display = showHiddenWords ? nonPunct : visible
              return (
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide mb-2 flex items-center gap-2">
                  {t.wordList}
                  {hidden.length > 0 && (
                    <button
                      onClick={() => setShowHiddenWords(v => !v)}
                      className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#333] rounded px-1.5 py-0.5 font-normal"
                    >
                      {showHiddenWords ? t.collapseSimpleWords : t.hiddenWordCount(hidden.length)}
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {display.map((w, i) => {
                    const wordSaved = savedWords.has(w.word)
                    const wordSaving = savingWord === w.word
                    const wordHidden = !isWordVisible(w.jlpt, settings.userLevel)
                    return (
                      <SwipeableRow
                        key={`sw-${i}`}
                        onSwipeRight={wordSaved ? undefined : () => handleQuickSaveWord(w)}
                        rightAction={wordSaved ? undefined : { bg: 'bg-green-500', icon: <BookmarkPlus size={20} className="text-white" /> }}
                      >
                      <div className={`${wordSaved ? 'bg-green-50 dark:bg-green-950/20' : vocabIndex?.has(w.word) ? vocabCardClass(vocabIndex.get(w.word)!) : 'bg-gray-50 dark:bg-[#252525]'} active:bg-gray-100 dark:active:bg-[#2a2a2a] rounded-xl p-3 flex items-start justify-between gap-2 ${wordHidden ? 'opacity-40' : ''}`}>
                        <button onClick={() => setSelectedWord(w)} className="flex-1 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <ruby className="font-jp font-bold text-gray-900 dark:text-gray-100" lang="ja">
                              {w.word}
                              {/[\u4e00-\u9fff]/.test(w.word) && (
                                <rt className="text-[10px] font-normal text-gray-400 dark:text-gray-500">{w.reading}</rt>
                              )}
                            </ruby>
                            {w.pitch !== undefined && (
                              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded px-1 py-0.5 leading-none">
                                {w.pitch}
                              </span>
                            )}
                            {w.jlpt && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#333] rounded px-1.5 py-0.5 leading-none">
                                {w.jlpt}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-[#333] rounded px-1.5 py-0.5">{w.pos}</span>
                          </div>
                          <div className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">{w.meaning}</div>
                        </button>
                        <button onClick={() => speak(w.word)} className="p-1 text-gray-300 dark:text-gray-600 active:text-gray-500 shrink-0 mt-0.5">
                          {wordSaving ? <Loader2 size={15} className="animate-spin" /> : <Volume2 size={15} />}
                        </button>
                      </div>
                      </SwipeableRow>
                    )
                  })}
                </div>
              </div>
              )
            })()}
          </div>
        )}
        </div>{/* flex-1 inner */}
      </div>

      {selectedWord && (
        <WordDetailSheet
          wordInfo={selectedWord}
          articleId={articleId}
          sentenceId={sentence.id}
          onClose={() => setSelectedWord(null)}
        />
      )}

      {selectedGrammar && (
        <GrammarDetailSheet
          grammar={selectedGrammar}
          onClose={() => setSelectedGrammar(null)}
        />
      )}
    </>
  )
}
