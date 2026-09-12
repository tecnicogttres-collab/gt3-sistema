'use client'

import React, { useRef, useState, useEffect } from 'react'

/**
 * Keeps previously-rendered pages alive in the DOM (display:none) so their
 * React state is preserved when the user switches tabs and comes back.
 *
 * For routes in componentMap: a single React.createElement(Comp) is created
 * on the first visit and stored forever. Because the exact same JS object sits
 * in the div on every subsequent render, React's reconciler bails out completely
 * — the component instance and all its state are never touched.
 *
 * For routes not in componentMap (e.g. SSR pages like /pdi): the children
 * received from Next.js on the first visit are cached and never overwritten,
 * which preserves state via the same "same-reference → no reconciliation" rule.
 */
export function TabContentCache({
  pathname,
  content,
  mainStyle,
  componentMap = {},
}: {
  pathname: string
  content: React.ReactNode
  mainStyle: React.CSSProperties
  componentMap?: Record<string, React.ComponentType>
}) {
  const contentCache = useRef<Map<string, React.ReactNode>>(new Map())

  if (!contentCache.current.has(pathname)) {
    const Comp = componentMap[pathname]
    // For known client modules: React.createElement produces a stable object
    // cached here once and reused on every future render — React never diffs it.
    // For SSR/unknown routes: fall back to children from Next.js (first visit only).
    contentCache.current.set(pathname, Comp ? React.createElement(Comp) : content)
  }

  const [visitedPaths, setVisitedPaths] = useState<string[]>([pathname])

  useEffect(() => {
    setVisitedPaths(prev => (prev.includes(pathname) ? prev : [...prev, pathname]))
  }, [pathname])

  // Include current pathname immediately (before the effect fires) so the page
  // is visible on the first render without a one-frame blank.
  const allPaths = visitedPaths.includes(pathname)
    ? visitedPaths
    : [...visitedPaths, pathname]

  return (
    <main style={mainStyle}>
      {allPaths.map(path => (
        <div key={path} style={{ display: path === pathname ? 'block' : 'none', height: '100%' }}>
          {contentCache.current.get(path)}
        </div>
      ))}
    </main>
  )
}
