import { useState, useCallback, useEffect, useRef } from 'react'
import type { ReceiverState, SendCommandFn, PostFn } from '../types'

interface Props {
  state: ReceiverState
  sendCommand: SendCommandFn
  post: PostFn
}

export default function VolumeControl({ state, sendCommand, post }: Props) {
  const volume = state?.volume
  const muted = state?.muted
  const volumeMax = state?.volume_max || 98
  const [dragging, setDragging] = useState(false)
  const [localVol, setLocalVol] = useState<number | undefined>(volume)
  const [zonesLinked, setZonesLinked] = useState(true)
  const previousVolume = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!dragging && volume != null) setLocalVol(volume)
  }, [volume, dragging])

  useEffect(() => {
    if (volume == null) return
    const previous = previousVolume.current
    previousVolume.current = volume
    if (previous == null || previous === volume || !zonesLinked) return

    const delta = volume - previous
    const zoneDelta = Math.sign(delta) * Math.round(Math.abs(delta))
    if (state.z2_power && state.z2_volume != null) {
      void post('/zone2/volume', { level: Math.max(0, Math.min(98, state.z2_volume + zoneDelta)) })
    }
    if (state.z3_power && state.z3_volume != null) {
      void post('/zone3/volume', { level: Math.max(0, Math.min(98, state.z3_volume + zoneDelta)) })
    }
  }, [volume, state.z2_power, state.z2_volume, state.z3_power, state.z3_volume, zonesLinked, post])

  const displayVol = dragging ? localVol : volume
  const dB = displayVol != null ? (displayVol - 80).toFixed(1) : '—'

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setLocalVol(val)
    setDragging(true)
    void post('/volume', { level: val })
  }, [post])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-xs font-medium text-denon-muted uppercase tracking-wider">Volume</h2>
            {(state.z2_power || state.z3_power) && (
              <button
                type="button"
                onClick={() => setZonesLinked(linked => !linked)}
                aria-pressed={zonesLinked}
                title={zonesLinked ? 'Zonenlautstärke von Master trennen' : 'Zonenlautstärke mit Master verbinden'}
                className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] transition-colors ${
                  zonesLinked
                    ? 'bg-denon-gold/15 text-denon-gold'
                    : 'bg-denon-surface text-denon-muted hover:text-denon-text'
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {zonesLinked
                    ? <><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.71-1.71" /></>
                    : <><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.71-1.71" /><path d="m3 3 18 18" /></>}
                </svg>
                {zonesLinked ? 'Verbunden' : 'Getrennt'}
              </button>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-denon-text">
              {displayVol != null ? displayVol : '—'}
            </span>
            <span className="text-sm text-denon-muted">{dB} dB</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => sendCommand('MVDOWN')}
            className="btn-ghost flex w-10 h-10 items-center justify-center text-lg font-bold rounded-xl"
          >−</button>
          <button
            onClick={() => sendCommand(muted ? 'MUOFF' : 'MUON')}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
              muted
                ? 'bg-denon-red/20 text-denon-red ring-1 ring-denon-red/30'
                : 'bg-denon-surface/70 text-denon-muted hover:bg-denon-border'
            }`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              {muted ? (
                <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
              ) : (
                <path d="M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4c-.55 0-1 .45-1 1zm13.5 2A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-3.98zM14 3.23v.06c0 .38.25.71.61.85C17.18 5.18 19 7.71 19 10.69c0 2.99-1.82 5.52-4.39 6.56-.36.14-.61.47-.61.85v.06c0 .63.63 1.09 1.22.86C18.6 17.84 21 14.53 21 10.69c0-3.83-2.4-7.14-5.78-8.32-.59-.23-1.22.24-1.22.86z"/>
              )}
            </svg>
          </button>
          <button
            onClick={() => sendCommand('MVUP')}
            className="btn-ghost flex w-10 h-10 items-center justify-center text-lg font-bold rounded-xl"
          >+</button>
        </div>
      </div>
      <input
        type="range"
        aria-label="Main zone volume"
        min={0} max={Math.min(volumeMax, 98)} step={0.5}
        value={displayVol ?? 0}
        onChange={handleChange}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-denon-muted/50 mt-1.5 px-0.5">
        <span>−80 dB</span>
        <span>0 dB</span>
        <span>+18 dB</span>
      </div>
      {(state.z2_power || state.z3_power) && (
        <div className="mt-4 space-y-3 border-t border-denon-border/50 pt-3">
          {state.z2_power && state.z2_volume != null && (
            <label className="block">
              <span className="mb-1 flex justify-between text-xs text-denon-muted">
                <span>Zone 2</span>
                <span className="tabular-nums text-denon-text">{state.z2_volume}</span>
              </span>
              <input
                type="range"
                aria-label="Zone 2 volume"
                min={0}
                max={98}
                step={1}
                value={state.z2_volume}
                onChange={event => void post('/zone2/volume', { level: Number(event.target.value) })}
                className="w-full"
              />
            </label>
          )}
          {state.z3_power && state.z3_volume != null && (
            <label className="block">
              <span className="mb-1 flex justify-between text-xs text-denon-muted">
                <span>Zone 3</span>
                <span className="tabular-nums text-denon-text">{state.z3_volume}</span>
              </span>
              <input
                type="range"
                aria-label="Zone 3 volume"
                min={0}
                max={98}
                step={1}
                value={state.z3_volume}
                onChange={event => void post('/zone3/volume', { level: Number(event.target.value) })}
                className="w-full"
              />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
