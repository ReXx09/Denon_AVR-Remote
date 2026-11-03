import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostFn } from '../types'

const SEND_INTERVAL_MS = 100
const CONFIRMATION_TIMEOUT_MS = 5000

export function useVolumeSlider(value: number | null | undefined, post: PostFn, path: string) {
  const [localValue, setLocalValue] = useState<number | undefined>(value ?? undefined)
  const [holdingLocalValue, setHoldingLocalValue] = useState(false)
  const pendingValue = useRef<number | undefined>(undefined)
  const lastSentValue = useRef<number | undefined>(undefined)
  const lastSentAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingConfirmation = useRef<number | undefined>(undefined)
  const receiverValue = useRef<number | undefined>(value ?? undefined)

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null

    const nextValue = pendingValue.current
    pendingValue.current = undefined
    if (nextValue == null || nextValue === lastSentValue.current) return

    lastSentValue.current = nextValue
    lastSentAt.current = Date.now()
    void post(path, { level: nextValue })
  }, [path, post])

  const change = useCallback((nextValue: number) => {
    if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
    confirmationTimer.current = null
    pendingConfirmation.current = undefined
    setLocalValue(nextValue)
    setHoldingLocalValue(true)
    pendingValue.current = nextValue

    const delay = SEND_INTERVAL_MS - (Date.now() - lastSentAt.current)
    if (delay <= 0) {
      flush()
    } else if (!timer.current) {
      timer.current = setTimeout(flush, delay)
    }
  }, [flush])

  const finish = useCallback((nextValue: number) => {
    setLocalValue(nextValue)
    pendingConfirmation.current = nextValue
    pendingValue.current = nextValue
    flush()

    if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
    if (receiverValue.current === nextValue) {
      pendingConfirmation.current = undefined
      setHoldingLocalValue(false)
    } else {
      setHoldingLocalValue(true)
      confirmationTimer.current = setTimeout(() => {
        confirmationTimer.current = null
        pendingConfirmation.current = undefined
        setLocalValue(receiverValue.current)
        setHoldingLocalValue(false)
      }, CONFIRMATION_TIMEOUT_MS)
    }
  }, [flush])

  useEffect(() => {
    if (value == null) return
    receiverValue.current = value
    if (pendingConfirmation.current === value) {
      pendingConfirmation.current = undefined
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
      confirmationTimer.current = null
      setLocalValue(value)
      setHoldingLocalValue(false)
    } else if (!holdingLocalValue) {
      setLocalValue(value)
    }
  }, [value, holdingLocalValue])

  useEffect(() => () => flush(), [flush])
  useEffect(() => () => {
    if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
  }, [])

  return { localValue, dragging: holdingLocalValue, change, finish }
}
