import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import BottomNav from './components/BottomNav'
import ArticlesPage from './pages/ArticlesPage'
import ImportPage from './pages/ImportPage'
import ArticleReadPage from './pages/ArticleReadPage'
import VocabPage from './pages/VocabPage'
import ReviewPage from './pages/ReviewPage'
import SettingsPage from './pages/SettingsPage'
import { getDueCount } from './lib/db'
import { useDarkMode } from './hooks/useDarkMode'
import { initDict, getDictStatus } from './lib/dict'

// Kick off dictionary download in the background on app load.
// Cached in IndexedDB after first download, ~10-40 MB one-time.
initDict()

function AppShell() {
  const location = useLocation()
  const [dueCount, setDueCount] = useState(0)
  const [dictStatus, setDictStatus] = useState(getDictStatus())
  useDarkMode() // initializes dark class on <html> based on stored preference
  const hideNav = location.pathname.startsWith('/article/') || location.pathname === '/import'

  useEffect(() => {
    getDueCount().then(setDueCount).catch(() => {})
  }, [location.pathname])

  useEffect(() => {
    if (dictStatus === 'ready' || dictStatus === 'unavailable') return
    const id = setInterval(() => {
      const s = getDictStatus()
      setDictStatus(s)
      if (s === 'ready' || s === 'unavailable') clearInterval(id)
    }, 300)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#111]">
      {dictStatus === 'loading' && (
        <div className="fixed top-0 inset-x-0 z-50 bg-blue-500 text-white text-center text-xs py-1">
          词典下载中…
        </div>
      )}
      <Routes>
        <Route path="/" element={<ArticlesPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/article/:id" element={<ArticleReadPage />} />
        <Route path="/vocab" element={<VocabPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      {!hideNav && <BottomNav dueCount={dueCount} />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
