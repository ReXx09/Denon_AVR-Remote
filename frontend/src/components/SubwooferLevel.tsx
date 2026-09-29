import { useState, useCallback, useEffect } from 'react'
import type { ReceiverState, PostFn } from '../types'

interface Props {
  state: ReceiverState
  post: PostFn
}

export default function SubwooferLevel({ state, post }: Props) {
  const [level, setLevel] = useState<number>(state?.subwoofer_level ?? 50)

  useEffect(() => {
    if (state?.subwoofer_level != null) setLevel(state.subwoofer_level)
  }, [state?.subwoofer_level])

  const dB = (val: number | null | undefined): string => {
    if (val == null) return '—'
    const d = val - 50
    if (d > 0) return `+${d}`
    return `${d}`
  }

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    setLevel(v)
    void post('/subwoofer-level', { level: v, index: 1 })
  }, [post])

  const adjustLevel = useCallback((delta: number) => {
    const next = Math.max(38, Math.min(62, level + delta))
    setLevel(next)
    void post('/subwoofer-level', { level: next, index: 1 })
  }, [level, post])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-denon-muted">Subwoofer Level</h2>
        <span className="text-xs tabular-nums text-denon-text">{dB(level)} dB</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => adjustLevel(-1)}
          className="btn-ghost h-8 w-8 shrink-0 rounded-lg text-base font-bold"
          aria-label="Decrease subwoofer level"
        >−</button>
        <input
          type="range" min={38} max={62} step={1}
          value={level} onChange={handleChange}
          className="w-full"
          aria-label="Subwoofer level"
        />
        <button
          type="button"
          onClick={() => adjustLevel(1)}
          className="btn-ghost h-8 w-8 shrink-0 rounded-lg text-base font-bold"
          aria-label="Increase subwoofer level"
        >+</button>
      </div>
      <div className="flex justify-between text-xs text-denon-muted mt-1">
        <span>−12 dB</span>
        <span>0 dB</span>
        <span>+12 dB</span>
      </div>
    </div>
  )
}
