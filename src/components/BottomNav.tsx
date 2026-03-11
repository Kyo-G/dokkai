import { Link, useLocation } from 'react-router-dom'
import { BookOpen, BookMarked, RotateCcw, Settings } from 'lucide-react'

interface Props {
  dueCount?: number
}

export default function BottomNav({ dueCount = 0 }: Props) {
  const { pathname } = useLocation()

  const tabs = [
    { path: '/', icon: BookOpen, label: '文章' },
    { path: '/vocab', icon: BookMarked, label: '生词本' },
    { path: '/review', icon: RotateCcw, label: '复习' },
    { path: '/settings', icon: Settings, label: '设置' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-[#333] z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = pathname === path || (path !== '/' && pathname.startsWith(path))
          return (
            <Link
              key={path}
              to={path}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors
                ${active ? 'text-red-700' : 'text-gray-400 dark:text-gray-500'}`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {path === '/review' && dueCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {dueCount > 99 ? '99+' : dueCount}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
