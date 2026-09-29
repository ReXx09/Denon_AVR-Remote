import { useEffect, useState } from 'react'
import type { ReceiverState, PostFn } from '../types'

interface Props {
  state: ReceiverState
  post: PostFn
}

export default function AudioSettings({ state, post }: Props) {
  const [profileExists, setProfileExists] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [settingMessage, setSettingMessage] = useState('')
  const source = state?.source
  const dynamicEq = state?.dynamic_eq
  const dynamicVol = state?.dynamic_volume
  const multeq = state?.multeq
  const sleepTimer = state?.sleep_timer
  const ecoMode = state?.eco_mode
  const dialogEnabled = state?.dialog_level_enabled
  const dialogLevel = state?.dialog_level ?? 0
  const referenceLevel = state?.ref_level_offset ?? 0

  const updateSetting = async (path: string, body: Record<string, unknown>) => {
    setSettingMessage('Sending...')
    const result = await post(path, body)
    setSettingMessage(result.ok ? 'Command sent' : 'Receiver did not accept the command')
  }

  useEffect(() => {
    let cancelled = false
    setProfileExists(false)
    setProfileMessage('')
    if (!source) return () => { cancelled = true }
    fetch('/api/v1/source-profiles')
      .then(response => response.ok ? response.json() as Promise<{ profiles?: Record<string, unknown> }> : Promise.reject())
      .then(data => {
        if (!cancelled) setProfileExists(Boolean(data.profiles?.[source]))
      })
      .catch(() => { if (!cancelled) setProfileMessage('Profile unavailable') })
    return () => { cancelled = true }
  }, [source])

  const saveProfile = async () => {
    if (!source) return
    const profile = {
      volume: state.volume,
      channel_volumes: state.channel_volumes,
      bass: state.bass,
      treble: state.treble,
      tone_enabled: state.tone_control,
      subwoofer_level: state.subwoofer_level,
      dialog_level: state.dialog_level,
      dialog_enabled: state.dialog_level_enabled,
      multeq: state.multeq,
      dynamic_eq: state.dynamic_eq,
      dynamic_volume: state.dynamic_volume,
      ref_level_offset: state.ref_level_offset,
    }
    const response = await fetch(`/api/v1/source-profiles/${encodeURIComponent(source)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    if (response.ok) {
      setProfileExists(true)
      setProfileMessage('Profile saved')
    } else {
      setProfileMessage('Profile could not be saved')
    }
  }

  const deleteProfile = async () => {
    if (!source) return
    const response = await fetch(`/api/v1/source-profiles/${encodeURIComponent(source)}`, { method: 'DELETE' })
    if (response.ok) {
      setProfileExists(false)
      setProfileMessage('Profile deleted')
    }
  }

  const dynVolModes = ['OFF', 'LIT', 'MED', 'HEV']
  const dynVolLabels: Record<string, string> = { OFF: 'Off', LIT: 'Light', MED: 'Medium', HEV: 'Heavy' }
  const multeqModes = ['AUDYSSEY', 'BYP.LR', 'FLAT', 'MANUAL', 'OFF']
  const multeqLabels: Record<string, string> = { AUDYSSEY: 'Audyssey', 'BYP.LR': 'L/R Bypass', FLAT: 'Flat', MANUAL: 'Manual', OFF: 'Off' }
  const ecoModes = ['ON', 'AUTO', 'OFF']

  return (
    <div className="card space-y-5">
      <h2 className="text-sm font-medium text-denon-muted">Audio Settings</h2>

      <div className="border-b border-denon-border/50 pb-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <span className="text-xs text-denon-muted block">Source profile</span>
            <span className="text-xs text-denon-text">{source || 'No source selected'}</span>
          </div>
          {profileExists && <span className="text-[10px] text-denon-green">Active</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void saveProfile()}
            disabled={!source}
            className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-denon-gold/20 text-denon-gold hover:bg-denon-gold/30 disabled:opacity-40"
          >
            Save current settings
          </button>
          {profileExists && (
            <button
              onClick={() => void deleteProfile()}
              className="text-xs px-3 py-1.5 rounded-lg bg-denon-surface text-denon-muted hover:text-denon-text"
            >
              Reset
            </button>
          )}
        </div>
        {profileMessage && <p className="text-[10px] text-denon-muted mt-2">{profileMessage}</p>}
        <p className="text-[10px] text-denon-muted/60 mt-2">Applied automatically when this source is selected.</p>
      </div>

      {/* Dialog Enhancer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-denon-muted">Dialog Enhancer</span>
          <button
            onClick={() => post('/dialog', { enabled: !dialogEnabled })}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${dialogEnabled ? 'bg-denon-gold/20 text-denon-gold' : 'bg-denon-surface text-denon-muted'}`}
          >
            {dialogEnabled ? 'On' : 'Off'}
          </button>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-denon-muted">Dialog Level</span>
            <span className="text-xs tabular-nums text-denon-text">{dialogLevel}</span>
          </div>
          <input
            type="range" min={0} max={12} step={1} value={dialogLevel}
            onChange={(e) => post('/dialog', { level: parseInt(e.target.value, 10) })}
            className="w-full"
            disabled={!dialogEnabled}
          />
        </div>
      </div>

      {/* Reference Level Offset */}
      <div>
        <span className="text-xs text-denon-muted block mb-2">Reference Level Offset</span>
        <div className="flex gap-1.5">
          {[0, 5, 10, 15].map(offset => (
            <button
              key={offset}
              onClick={() => post('/reference-level', { offset })}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all flex-1 ${referenceLevel === offset ? 'bg-denon-gold text-denon-dark' : 'bg-denon-surface text-denon-muted hover:bg-denon-border'}`}
            >
              {offset} dB
            </button>
          ))}
        </div>
      </div>

      {/* MultEQ */}
      <div>
        <span className="text-xs text-denon-muted block mb-2">MultEQ</span>
        <div className="flex flex-wrap gap-1.5">
          {multeqModes.map(m => (
            <button
              key={m}
              onClick={() => post('/multeq', { mode: m })}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                multeq === m
                  ? 'bg-denon-gold text-denon-dark'
                  : 'bg-denon-surface text-denon-muted hover:bg-denon-border'
              }`}
            >
              {multeqLabels[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic EQ */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-denon-muted">Dynamic EQ</span>
        <button
          type="button"
          onClick={() => void updateSetting('/dynamic-eq', { enabled: !dynamicEq })}
          aria-pressed={Boolean(dynamicEq)}
          className={`min-w-[52px] text-xs px-3 py-2 rounded-lg transition-all ${
            dynamicEq
              ? 'bg-denon-gold/20 text-denon-gold'
              : 'bg-denon-surface text-denon-muted'
          }`}
        >
          {dynamicEq ? 'On' : 'Off'}
        </button>
      </div>
      {settingMessage && <p className="text-[10px] text-denon-muted -mt-3">{settingMessage}</p>}

      {/* Dynamic Volume */}
      <div>
        <span className="text-xs text-denon-muted block mb-2">Dynamic Volume</span>
        <div className="flex gap-1.5">
          {dynVolModes.map(m => (
            <button
              key={m}
              onClick={() => post('/dynamic-volume', { mode: m })}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all flex-1 ${
                dynamicVol === m
                  ? 'bg-denon-gold text-denon-dark'
                  : 'bg-denon-surface text-denon-muted hover:bg-denon-border'
              }`}
            >
              {dynVolLabels[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Eco Mode */}
      <div>
        <span className="text-xs text-denon-muted block mb-2">Eco Mode</span>
        <div className="flex gap-1.5">
          {ecoModes.map(m => (
            <button
              key={m}
              onClick={() => post('/eco', { mode: m })}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all flex-1 ${
                ecoMode === m
                  ? 'bg-denon-gold text-denon-dark'
                  : 'bg-denon-surface text-denon-muted hover:bg-denon-border'
              }`}
            >
              {m === 'ON' ? 'On' : m === 'AUTO' ? 'Auto' : 'Off'}
            </button>
          ))}
        </div>
      </div>

      {/* Sleep Timer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-denon-muted">Sleep Timer</span>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-denon-text">
            {sleepTimer ? `${sleepTimer} min` : 'Off'}
          </span>
          <select
            value={sleepTimer || ''}
            onChange={(e) => post('/sleep', { minutes: e.target.value ? parseInt(e.target.value) : 0 })}
            className="bg-denon-surface text-denon-text text-xs rounded-lg px-2 py-1.5 border border-denon-border"
          >
            <option value="">Off</option>
            <option value="10">10 min</option>
            <option value="20">20 min</option>
            <option value="30">30 min</option>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
            <option value="120">120 min</option>
          </select>
        </div>
      </div>
    </div>
  )
}
