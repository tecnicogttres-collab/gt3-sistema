'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export function useToast(duration = 2500) {
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'danger' | ''>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string, tipo: 'success' | 'danger' | '' = '') => {
    setToast(msg)
    setToastType(tipo)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { setToast(''); setToastType('') }, duration)
  }, [duration])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return { toast, toastType, showToast }
}
