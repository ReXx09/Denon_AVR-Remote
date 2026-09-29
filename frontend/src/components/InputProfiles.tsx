import { useEffect, useMemo, useState } from 'react'
import type { ReceiverState, SourceEntry } from '../types'

interface SourceProfile {
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

const toDb = (value: number | undefined, zero = 50): string => {
  if (value == null) return '—'
  const db = value - zero
  return `${db > 0 ? '+' : ''}${db} dB`
}

export default function InputProfiles({ sources, state, channelNames }: Props) {
  const [selectedSource, setSelectedSource] = useState(state.source || sources[0]?.id || '')
  const [profiles, setProfiles] = useState<Record<string, SourceProfile>>({})

  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/source-profiles')
      .then(response => response.ok ? response.json() as Promise<{ profiles?: Record<string, SourceProfile> }> : Promise.reject())
      .then(data => {
        if (!cancelled) setProfiles(data.profiles || {})
      })
      .catch(() => {
        if (!cancelled) setProfiles({})
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedSource && sources[0]) setSelectedSource(sources[0].id)
  }, [selectedSource, sources])

  const profile = profiles[selectedSource]
  const channels = useMemo(() => Object.entries(profile?.channel_volumes || {}), [profile])
  const selectedName = sources.find(source => source.id === selectedSource)?.name || selectedSource

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-denon-muted uppercase tracking-wider">Input Profiles</h2>
        <span className="text-[10px] text-denon-muted">Profile preview only</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sources.map(source => {
          const selected = selectedSource === source.id
          const hasProfile = Boolean(profiles[source.id])
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => setSelectedSource(source.id)}
              aria-pressed={selected}
              className={`min-w-0 rounded-lg px-3 py-2 text-left text-xs transition-all ${
                selected
                  ? 'bg-denon-gold/20 text-denon-gold ring-1 ring-denon-gold/40'
                  : 'bg-denon-surface/70 text-denon-muted hover:bg-denon-surface hover:text-denon-text'
              }`}
            >
              <span className="block truncate">{source.name}</span>
              <span className="mt-0.5 block text-[10px] opacity-50">{hasProfile ? 'Profile saved' : 'No profile'}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 border-t border-denon-border/50 pt-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-denon-text">{selectedName}</span>
          <span className="text-[10px] text-denon-muted">AVR input: unchanged</span>
        </div>
        {profile ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-denon-surface/60 p-2"><span className="block text-denon-muted">Tone</span><strong>{profile.tone_enabled == null ? '—' : profile.tone_enabled ? 'On' : 'Off'}</strong></div>
              <div className="rounded-lg bg-denon-surface/60 p-2"><span className="block text-denon-muted">Bass</span><strong>{toDb(profile.bass)}</strong></div>
              <div className="rounded-lg bg-denon-surface/60 p-2"><span className="block text-denon-muted">Treble</span><strong>{toDb(profile.treble)}</strong></div>
            </div>
            <div className="rounded-lg bg-denon-surface/60 p-2"><span className="text-denon-muted">Subwoofer</span><strong className="float-right">{toDb(profile.subwoofer_level, 50)}</strong></div>
            {channels.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {channels.map(([channel, value]) => <div key={channel} className="flex justify-between"><span className="text-denon-muted">{channelNames[channel] || channel}</span><strong>{toDb(value)}</strong></div>)}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-denon-muted/70">No saved settings for this input yet. The receiver remains on its current input.</p>
        )}
      </div>
    </div>
  )
}
