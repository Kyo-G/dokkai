import { useRef, useState } from 'react'

interface Action {
  bg: string           // Tailwind bg class, e.g. "bg-red-500"
  icon: React.ReactNode
}

interface Props {
  children: React.ReactNode
  onSwipeLeft?: () => void    // triggered when swiped left past threshold (delete)
  onSwipeRight?: () => void   // triggered when swiped right past threshold (save)
  leftAction?: Action         // icon/bg revealed when swiping left
  rightAction?: Action        // icon/bg revealed when swiping right
  threshold?: number          // px needed to trigger action
  className?: string
}

export default function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  threshold = 72,
  className = '',
}: Props) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<'x' | 'y' | null>(null)
  const fired = useRef(false)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    axis.current = null
    fired.current = false
    setDragging(true)
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    // Determine swipe axis after 6 px of movement
    if (!axis.current) {
      if (Math.abs(dx) > Math.abs(dy) + 4) axis.current = 'x'
      else if (Math.abs(dy) > Math.abs(dx) + 4) axis.current = 'y'
      else return
    }

    if (axis.current === 'y') return

    // Clamp to available directions
    const max = threshold * 1.4
    const clamped = Math.max(
      onSwipeLeft  ? -max : 0,
      Math.min(onSwipeRight ? max : 0, dx)
    )
    setOffset(clamped)
  }

  function onTouchEnd(e: React.TouchEvent) {
    // Stop propagation when we handled an x-axis swipe so parent
    // page-level swipe handlers don't also fire
    if (axis.current === 'x') e.stopPropagation()
    if (!fired.current) {
      if (offset <= -threshold) { fired.current = true; onSwipeLeft?.() }
      else if (offset >= threshold) { fired.current = true; onSwipeRight?.() }
    }
    setOffset(0)
    setDragging(false)
    axis.current = null
  }

  const leftP  = Math.min(1, -offset / threshold)   // 0→1 swiping left
  const rightP = Math.min(1, offset / threshold)     // 0→1 swiping right

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {/* Delete background (left swipe) */}
      {leftAction && (
        <div
          className={`absolute inset-0 flex items-center justify-end pr-5 ${leftAction.bg}`}
          style={{ opacity: leftP }}
        >
          <div style={{ transform: `scale(${0.75 + leftP * 0.25})`, transition: 'transform 0.1s' }}>
            {leftAction.icon}
          </div>
        </div>
      )}

      {/* Save background (right swipe) */}
      {rightAction && (
        <div
          className={`absolute inset-0 flex items-center justify-start pl-5 ${rightAction.bg}`}
          style={{ opacity: rightP }}
        >
          <div style={{ transform: `scale(${0.75 + rightP * 0.25})`, transition: 'transform 0.1s' }}>
            {rightAction.icon}
          </div>
        </div>
      )}

      {/* Card content */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)',
          willChange: 'transform',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
