import { useState, useCallback, useEffect } from 'react'
import type { ReceiverState, PostFn } from '../types'
import { useLanguage } from '../language'

interface Props {
  state: ReceiverState
  post: PostFn
}

export default function ToneControls({ state, post }: Props) {
  const { tr } = useLanguage()
  const [bass, setBass] = useState<number>(state?.bass ?? 50)
  const [treble, setTreble] = useState<number>(state?.treble ?? 50)

  useEffect(() => {
    if (state?.bass != null) setBass(state.bass)
    if (state?.treble != null) setTreble(state.treble)
  }, [state?.bass, state?.treble])

  const dB = (val: number): string => {
    const d = val - 50
    if (d > 0) return `+${d}`
    return `${d}`
  }

  const handleBass = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    setBass(v)
    void post('/tone', { bass: v })
  }, [post])

  const handleTreble = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    setTreble(v)
    void post('/tone', { treble: v })
  }, [post])

  const adjust = (setting: 'bass' | 'treble', value: number, delta: number) => {
    const next = Math.max(44, Math.min(56, value + delta))
    if (setting === 'bass') {
      setBass(next)
      void post('/tone', { bass: next })
    } else {
      setTreble(next)
      void post('/tone', { treble: next })
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-denon-muted uppercase tracking-wider">{tr('Tone Controls')}</h2>
      </div>

      <div className="space-y-4 fade-in">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-denon-muted">{tr('Bass')}</span>
              <span className="text-xs tabular-nums text-denon-text font-semibold">{dB(bass)} dB</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => adjust('bass', bass, -1)} className="btn-ghost flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-bold" aria-label="Decrease bass">−</button>
              <input type="range" min={44} max={56} step={1} value={bass} onChange={handleBass} className="w-full" aria-label="Bass level" />
              <button type="button" onClick={() => adjust('bass', bass, 1)} className="btn-ghost flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-bold" aria-label="Increase bass">+</button>
            </div>
            <div className="flex justify-between text-[10px] text-denon-muted/60 mt-1 px-10"><span>−6 dB</span><span>0 dB</span><span>+6 dB</span></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-denon-muted">{tr('Treble')}</span>
              <span className="text-xs tabular-nums text-denon-text font-semibold">{dB(treble)} dB</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => adjust('treble', treble, -1)} className="btn-ghost flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-bold" aria-label="Decrease treble">−</button>
              <input type="range" min={44} max={56} step={1} value={treble} onChange={handleTreble} className="w-full" aria-label="Treble level" />
              <button type="button" onClick={() => adjust('treble', treble, 1)} className="btn-ghost flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-bold" aria-label="Increase treble">+</button>
            </div>
            <div className="flex justify-between text-[10px] text-denon-muted/60 mt-1 px-10"><span>−6 dB</span><span>0 dB</span><span>+6 dB</span></div>
          </div>
      </div>
    </div>
  )
}
