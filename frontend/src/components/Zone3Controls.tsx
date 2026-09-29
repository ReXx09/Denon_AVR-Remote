import { useState, useCallback, useEffect } from 'react'
import PowerControl from './PowerControl'
import MediaControls from './MediaControls'
import SourceSelector from './SourceSelector'
import type { ReceiverState, SendCommandFn, PostFn, SourceEntry, RadioFavorite } from '../types'

interface Props {
  state: ReceiverState
  sendCommand: SendCommandFn
  post: PostFn
  sources: SourceEntry[]
  sourceNameMap?: Record<string, string>
  sourceNameOverrides?: Record<string, string>
  radioFavorites?: RadioFavorite[]
  onRenameSource?: (code: string, name: string | null) => void
  onRadioFavoriteChange?: (favorite: RadioFavorite, enabled: boolean) => void
}

export default function Zone3Controls({ state, sendCommand, post, sources, sourceNameMap, sourceNameOverrides, radioFavorites, onRenameSource, onRadioFavoriteChange }: Props) {
  const volume = state?.z3_volume
  const muted = state?.z3_muted
  const sleepTimer = state?.z3_sleep_timer
  const [localVol, setLocalVol] = useState<number>(volume ?? 0)
  const [selectedSleep, setSelectedSleep] = useState<'OFF' | number>(sleepTimer ?? 'OFF')

  useEffect(() => {
    if (volume != null) setLocalVol(volume)
  }, [volume])

  useEffect(() => {
    setSelectedSleep(sleepTimer ?? 'OFF')
  }, [sleepTimer])

  const handleVolChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setLocalVol(value)
    void post('/zone3/volume', { level: value })
  }, [post])

  return (
    <div className="space-y-4">
      <PowerControl state={state} sendCommand={sendCommand} zone="zone3" />

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-medium text-denon-muted uppercase tracking-wider mb-1">Volume</h2>
            <p className="text-2xl font-bold tabular-nums">{localVol}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => sendCommand('Z3DOWN')} className="btn-ghost w-10 h-10 flex items-center justify-center text-lg font-bold">−</button>
            <button
              onClick={() => sendCommand(muted ? 'Z3MUOFF' : 'Z3MUON')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${muted ? 'bg-denon-red/20 text-denon-red ring-1 ring-denon-red/30' : 'bg-denon-surface/70 text-denon-muted hover:bg-denon-border'}`}
              title={muted ? 'Unmute' : 'Mute'}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {muted ? <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0z" /> : <path d="M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4c-.55 0-1 .45-1 1zm13.5 2A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-3.98zM14 3.23v.06c0 .38.25.71.61.85C17.18 5.18 19 7.71 19 10.69c0 2.99-1.82 5.52-4.39 6.56-.36.14-.61.47-.61.85v.06c0 .63.63 1.09 1.22.86C18.6 17.84 21 14.53 21 10.69c0-3.83-2.4-7.14-5.78-8.32-.59-.23-1.22.24-1.22.86z" />}
              </svg>
            </button>
            <button onClick={() => sendCommand('Z3UP')} className="btn-ghost w-10 h-10 flex items-center justify-center text-lg font-bold">+</button>
          </div>
        </div>
        <input type="range" min={0} max={98} step={1} value={localVol} onChange={handleVolChange} className="w-full" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-medium text-denon-muted uppercase tracking-wider mb-1">Sleep Timer</h2>
            <p className="text-sm text-denon-text">{sleepTimer == null ? 'Off' : `${sleepTimer} min`}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedSleep}
              onChange={(e) => setSelectedSleep(e.target.value === 'OFF' ? 'OFF' : parseInt(e.target.value, 10))}
              className="bg-denon-surface border border-denon-border/50 rounded-xl text-sm px-3 py-2 text-denon-text"
            >
              <option value="OFF">OFF</option>
              {[10, 20, 30, 60, 90, 120].map(minutes => <option key={minutes} value={minutes}>{minutes} min</option>)}
            </select>
            <button
              onClick={() => post('/zone3/sleep', { minutes: selectedSleep === 'OFF' ? 0 : selectedSleep })}
              className="btn-ghost px-4 py-2 text-sm font-medium"
            >
              Set
            </button>
          </div>
        </div>
      </div>

      <MediaControls state={state} sendCommand={sendCommand} post={post} zone="zone3" />

      <SourceSelector
        state={state}
        sendCommand={sendCommand}
        sources={sources}
        sourceNameMap={sourceNameMap}
        sourceNameOverrides={sourceNameOverrides}
        radioFavorites={radioFavorites}
        onRenameSource={onRenameSource}
        onRadioFavoriteChange={onRadioFavoriteChange}
        zone="zone3"
      />
    </div>
  )
}
