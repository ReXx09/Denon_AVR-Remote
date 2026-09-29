import { useEffect, useMemo, useState } from 'react'
import type { ReceiverState, SourceEntry } from '../types'

interface SourceProfile {
  analog_input_level?: number
  digital_input_level?: number
  bass?: number
  treble?: number
  tone_enabled?: boolean
  subwoofer_level?: number
  channel_volumes?: Record<string, number>
}

interface Props {
  sources: SourceEntry[]
  state: ReceiverState
  channelNames: Record<string, string>
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const toDb = (value: number | undefined, zero = 50): string => {
  if (value == null) return '—'
  const db = value - zero
  return `${db > 0 ? '+' : ''}${db} dB`
}

export default function InputProfiles({ sources, state, channelNames }: Props) {
  const [selectedSource, setSelectedSource] = useState(state.source || sources[0]?.id || '')
  const [profiles, setProfiles] = useState<Record<string, SourceProfile>>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/source-profiles')
      .then(response => response.ok ? response.json() as Promise<{ profiles?: Record<string, SourceProfile> }> : Promise.reject())
      .then(data => { if (!cancelled) setProfiles(data.profiles || {}) })
      .catch(() => { if (!cancelled) setProfiles({}) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedSource && sources[0]) setSelectedSource(sources[0].id)
  }, [selectedSource, sources])

  const liveChannels = state.channel_volumes || {}
  const savedProfile = profiles[selectedSource]
  const profile: SourceProfile = savedProfile || {
    bass: state.bass ?? 50,
    treble: state.treble ?? 50,
    tone_enabled: state.tone_control,
    subwoofer_level: state.subwoofer_level ?? 50,
    channel_volumes: liveChannels,
  }
  const channels = useMemo(() => Object.keys({ ...liveChannels, ...profile.channel_volumes }), [liveChannels, profile.channel_volumes])
  const selectedName = sources.find(source => source.id === selectedSource)?.name || selectedSource

  const updateProfile = (updates: Partial<SourceProfile>) => {
    setProfiles(current => ({ ...current, [selectedSource]: { ...profile, ...updates } }))
    setMessage('')
  }

  const updateChannel = (channel: string, delta: number) => {
    const current = profile.channel_volumes?.[channel] ?? liveChannels[channel] ?? 50
    updateProfile({ channel_volumes: { ...profile.channel_volumes, [channel]: clamp(current + delta, 38, 62) } })
  }

  const inputLevel = (kind: 'analog_input_level' | 'digital_input_level') => profile[kind] ?? 0

  const saveProfile = async () => {
    const response = await fetch(`/api/v1/source-profiles/${encodeURIComponent(selectedSource)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    setMessage(response.ok ? 'Profile saved' : 'Profile could not be saved')
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xs font-medium text-denon-muted uppercase tracking-wider">Input Profiles</h2>
          <p className="text-[10px] text-denon-muted/60 mt-1">Configure each input without switching the AVR</p>
        </div>
        <span className="text-[10px] text-denon-muted">{selectedName}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sources.map(source => {
          const selected = selectedSource === source.id
          const hasProfile = Boolean(profiles[source.id])
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => { setSelectedSource(source.id); setMessage('') }}
              aria-pressed={selected}
              className={`min-w-0 rounded-lg px-3 py-2 text-left text-xs transition-all ${selected ? 'bg-denon-gold/20 text-denon-gold ring-1 ring-denon-gold/40' : 'bg-denon-surface/70 text-denon-muted hover:bg-denon-surface hover:text-denon-text'}`}
            >
              <span className="block truncate">{source.name}</span>
              <span className="mt-0.5 block text-[10px] opacity-50">{hasProfile ? 'Profile saved' : 'New profile'}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 border-t border-denon-border/50 pt-3 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {(['analog_input_level', 'digital_input_level'] as const).map(kind => {
            const value = inputLevel(kind)
            return (
              <div key={kind}>
                <div className="flex justify-between text-xs mb-1"><span className="text-denon-muted">{kind === 'analog_input_level' ? 'Analog input' : 'Digital input'}</span><strong>{value > 0 ? '+' : ''}{value} dB</strong></div>
                <input type="range" min={-12} max={12} step={1} value={value} onChange={event => updateProfile({ [kind]: Number(event.target.value) })} className="w-full" aria-label={`${kind} profile level`} />
                <div className="flex justify-between text-[10px] text-denon-muted/60"><span>−12</span><span>0</span><span>+12 dB</span></div>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(['bass', 'treble'] as const).map(setting => {
            const value = profile[setting] ?? 50
            return (
              <div key={setting}>
                <div className="flex justify-between text-xs mb-1"><span className="text-denon-muted capitalize">{setting}</span><strong>{toDb(value)}</strong></div>
                <input type="range" min={44} max={56} value={value} onChange={event => updateProfile({ [setting]: Number(event.target.value) })} className="w-full" aria-label={`${setting} profile level`} />
                <div className="flex justify-between text-[10px] text-denon-muted/60"><span>−6</span><span>0</span><span>+6 dB</span></div>
              </div>
            )
          })}
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1"><span className="text-denon-muted">Subwoofer</span><strong>{toDb(profile.subwoofer_level)}</strong></div>
          <input type="range" min={38} max={62} value={profile.subwoofer_level ?? 50} onChange={event => updateProfile({ subwoofer_level: Number(event.target.value) })} className="w-full" aria-label="Subwoofer profile level" />
          <div className="flex justify-between text-[10px] text-denon-muted/60"><span>−12</span><span>0</span><span>+12 dB</span></div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-xs text-denon-muted">Speaker levels</span><span className="text-[10px] text-denon-muted/60">Profile only</span></div>
          {channels.map(channel => {
            const value = profile.channel_volumes?.[channel] ?? liveChannels[channel] ?? 50
            return (
              <div key={channel} className="flex items-center gap-2 text-xs">
                <span className="w-24 truncate text-denon-muted">{channelNames[channel] || channel}</span>
                <button type="button" onClick={() => updateChannel(channel, -1)} className="btn-ghost h-7 w-7 shrink-0 p-0" aria-label={`Decrease ${channelNames[channel] || channel}`}>−</button>
                <input type="range" min={38} max={62} value={value} onChange={event => updateProfile({ channel_volumes: { ...profile.channel_volumes, [channel]: Number(event.target.value) } })} className="w-full" aria-label={`${channelNames[channel] || channel} profile level`} />
                <button type="button" onClick={() => updateChannel(channel, 1)} className="btn-ghost h-7 w-7 shrink-0 p-0" aria-label={`Increase ${channelNames[channel] || channel}`}>+</button>
                <strong className="w-14 text-right">{toDb(value)}</strong>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between border-t border-denon-border/50 pt-3">
          <span className="text-[10px] text-denon-muted">{message || 'Changes are local until saved'}</span>
          <button type="button" onClick={() => void saveProfile()} className="btn-primary text-xs px-4 py-2">Save profile</button>
        </div>
      </div>
    </div>
  )
}
