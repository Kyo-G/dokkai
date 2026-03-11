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

function AppShell() {
  const location = useLocation()
  const [dueCount, setDueCount] = useState(0)
  useDarkMode() // initializes dark class on <html> based on stored preference
  const hideNav = location.pathname.startsWith('/article/') || location.pathname === '/import'

  useEffect(() => {
    getDueCount().then(setDueCount).catch(() => {})
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#111]">
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
