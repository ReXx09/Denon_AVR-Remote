import { useEffect, useState } from 'react'
import RadioBrowser from './RadioBrowser'
import ServerBrowser from './ServerBrowser'
import NavidromeBrowser from './NavidromeBrowser'
import type { ReceiverState, SendCommandFn, PostFn, Zone, RadioFavorite } from '../types'

const MEDIA_SOURCES = ['NET', 'MPLAY', 'BT', 'USB', 'USB/IPOD', 'SPOTIFY', 'AMAZON', 'PANDORA', 'SIRIUSXM', 'IRADIO', 'SERVER', 'FAVORITES']
const HEOS_PRESET_SOURCES = new Set(['NET', 'IRADIO'])
const VALID_ACTIONS = new Set(['play', 'pause', 'stop', 'next', 'previous'])

/** Sanitize album art URL — only allow http(s) to prevent XSS via javascript: or data: URIs. */
function safeImageUrl(url: string | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : null
  } catch { return null }
}

interface Props {
  state: ReceiverState
  sendCommand: SendCommandFn
  post: PostFn
  zone?: Zone
  radioFavorites?: RadioFavorite[]
  onRadioFavoriteChange?: (favorite: RadioFavorite, enabled: boolean) => void
  sourceFavorites?: string[]
  onSourceFavoriteChange?: (source: string, enabled: boolean) => void
}

interface QueueItem {
  song?: string
  artist?: string
  album?: string
  image_url?: string
  qid?: number
}

interface HeosPreset {
  mid?: string
  sid?: number | string
  name: string
  station?: string
  image_url?: string
  playable?: string
}

export default function MediaControls({
  state,
  zone = 'main',
  radioFavorites = [],
  onRadioFavoriteChange,
  sourceFavorites = [],
  onSourceFavoriteChange,
}: Props) {
  const source = zone === 'main' ? state?.source : zone === 'zone2' ? state?.z2_source : state?.z3_source
  const sourceName = zone === 'main'
    ? state?.source_name
    : zone === 'zone2' ? state?.z2_source_name : state?.z3_source_name
  const mediaCapable = source != null && MEDIA_SOURCES.includes(source)
  const heosSourceSelected = source != null && HEOS_PRESET_SOURCES.has(source)

  // Now-playing data comes from WebSocket state (backend polls HEOS once for all clients)
  const nowPlaying = state?.now_playing
  const playState = state?.play_state
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueError, setQueueError] = useState(false)
  const [heosPresets, setHeosPresets] = useState<HeosPreset[]>([])
  const [heosPresetsOpen, setHeosPresetsOpen] = useState(false)
  const [radioOpen, setRadioOpen] = useState(false)
  const [optimisticPlayState, setOptimisticPlayState] = useState<string | null>(null)

  useEffect(() => {
    setOptimisticPlayState(null)
  }, [playState])

  const doMedia = async (action: string) => {
    if (!VALID_ACTIONS.has(action)) return
    if (action === 'play' || action === 'pause') {
      setOptimisticPlayState(action)
    }
    try {
      const response = await fetch(`/api/v1/media/${action}`, { method: 'POST' })
      if (!response.ok && (action === 'play' || action === 'pause')) {
        setOptimisticPlayState(null)
      }
    } catch {
      if (action === 'play' || action === 'pause') setOptimisticPlayState(null)
    }
  }

  const loadQueue = async () => {
    setQueueLoading(true)
    setQueueError(false)
    try {
      const response = await fetch('/api/v1/media/queue')
      if (!response.ok) throw new Error('Queue request failed')
      const data = await response.json() as { queue?: QueueItem[] }
      setQueue(Array.isArray(data.queue) ? data.queue : [])
    } catch {
      setQueueError(true)
    } finally {
      setQueueLoading(false)
    }
  }

  useEffect(() => {
    if (mediaCapable) void loadQueue()
  }, [mediaCapable, nowPlaying?.song, nowPlaying?.station])

  useEffect(() => {
    if (!heosSourceSelected) {
      setHeosPresetsOpen(false)
      return
    }
    fetch('/api/v1/media/heos/favorites')
      .then(response => response.ok ? response.json() as Promise<{ items?: HeosPreset[] }> : Promise.reject())
      .then(data => setHeosPresets((data.items || []).filter(item => item.mid && item.playable === 'yes')))
      .catch(() => setHeosPresets([]))
  }, [heosSourceSelected])

  const playPreset = async (preset: HeosPreset) => {
    if (!preset.mid) return
    await fetch('/api/v1/media/heos/favorites/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid: Number(preset.sid ?? 1028), mid: preset.mid }),
    })
  }

  if (!mediaCapable) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-denon-muted uppercase tracking-wider">Media</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-denon-green/10 text-denon-green">Active input</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-denon-surface flex items-center justify-center text-lg" aria-hidden="true">
            🎬
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-denon-text truncate">{sourceName || source || 'Unknown input'}</p>
            <p className="text-xs text-denon-muted">Audio/video signal from this input</p>
          </div>
        </div>
      </div>
    )
  }

  const isPlaying = (optimisticPlayState ?? playState) === 'play'
  const song = nowPlaying?.song || nowPlaying?.title || nowPlaying?.track
  const artist = nowPlaying?.artist || nowPlaying?.artist_name
  const station = nowPlaying?.station || nowPlaying?.station_name || nowPlaying?.channel
  const albumArt = safeImageUrl(nowPlaying?.image_url)
  const streamQuality = state?.stream_quality

  // For radio/stations: show station name when no song title is available
  const title = song || station
  const subtitle = artist
  const sourceIsFavorite = Boolean(source && sourceFavorites.includes(source))

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-medium text-denon-muted uppercase tracking-wider">Now Playing</h2>
          {source && onSourceFavoriteChange && (
            <button
              type="button"
              onClick={() => onSourceFavoriteChange(source, !sourceIsFavorite)}
              className={`text-base leading-none transition-colors ${sourceIsFavorite ? 'text-denon-gold' : 'text-denon-muted hover:text-denon-gold'}`}
              title={sourceIsFavorite ? 'Remove source favorite' : 'Add source favorite'}
              aria-label={sourceIsFavorite ? 'Remove source favorite' : 'Add source favorite'}
            >
              {sourceIsFavorite ? '★' : '☆'}
            </button>
          )}
        </div>
        {onRadioFavoriteChange && (
          <button
            type="button"
            onClick={() => setRadioOpen(true)}
            className="text-xs text-denon-gold hover:text-denon-text transition-colors"
          >
            Radio
          </button>
        )}
      </div>

      {sourceName && (
        <p className="mb-3 truncate text-xs text-denon-muted" title={sourceName}>
          Source: <span className="text-denon-text">{sourceName}</span>
        </p>
      )}

      {/* Now Playing Info */}
      {(title || subtitle || station) && (
        <div className="flex items-center gap-3 mb-2">
          {albumArt && (
            <img
              src={albumArt}
              alt="Album art"
              className="w-16 h-16 rounded-lg object-cover shadow-md flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            {station && <p className="text-xs text-denon-muted truncate">Station: {station}</p>}
            {title && <p className="text-base font-semibold text-denon-text truncate">{title}</p>}
            {subtitle && subtitle !== station && <p className="text-xs text-denon-muted truncate">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              isPlaying
                ? 'bg-denon-green/10 text-denon-green'
                : 'bg-denon-surface text-denon-text'
            }`}>
              {isPlaying ? '▶ Playing' : '⏸ Paused'}
            </span>
            {streamQuality && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-denon-surface text-denon-text">
                {streamQuality}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Transport Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => doMedia('previous')}
          className="w-11 h-11 rounded-xl bg-denon-surface/70 text-denon-muted hover:text-denon-text hover:bg-denon-surface transition-all active:scale-95 flex items-center justify-center"
          title="Previous"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        <button
          onClick={() => doMedia(isPlaying ? 'pause' : 'play')}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-denon-gold to-amber-600 text-denon-dark shadow-lg shadow-denon-gold/25 hover:brightness-110 transition-all active:scale-95 flex items-center justify-center"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        <button
          onClick={() => doMedia('next')}
          className="w-11 h-11 rounded-xl bg-denon-surface/70 text-denon-muted hover:text-denon-text hover:bg-denon-surface transition-all active:scale-95 flex items-center justify-center"
          title="Next"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      {heosSourceSelected && heosPresets.length > 0 && (
        <div className="mt-3 border-t border-denon-border/50 pt-3">
          <button
            type="button"
            onClick={() => setHeosPresetsOpen(open => !open)}
            className="mb-2 flex w-full items-center justify-between text-left text-[10px] uppercase tracking-wider text-denon-muted hover:text-denon-text"
            aria-expanded={heosPresetsOpen}
          >
            <span>HEOS Presets</span>
            <span aria-hidden="true">{heosPresetsOpen ? '▴' : '▾'}</span>
          </button>
          {heosPresetsOpen && <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {heosPresets.map((preset, index) => (
              <button
                key={`${preset.sid}-${preset.mid}`}
                type="button"
                onClick={() => void playPreset(preset)}
                className="group flex w-28 shrink-0 flex-col rounded-xl border border-denon-border/70 bg-denon-surface/45 p-2 text-left transition-all hover:border-denon-gold/60 hover:bg-denon-surface hover:shadow-lg hover:shadow-black/20 active:scale-[.98]"
                title={preset.station || preset.name}
              >
                <span className="relative mb-1.5 flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-denon-dark">
                  {safeImageUrl(preset.image_url) ? (
                    <img
                      src={safeImageUrl(preset.image_url) || undefined}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-3xl text-denon-muted" aria-hidden="true">♫</span>
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-denon-gold">
                    #{index + 1}
                  </span>
                </span>
                <span className="min-w-0 px-0.5">
                  <span className="block truncate text-xs font-medium text-denon-text group-hover:text-denon-gold">{preset.name}</span>
                  {preset.station && preset.station !== preset.name && <span className="block truncate text-[10px] text-denon-muted">{preset.station}</span>}
                </span>
              </button>
            ))}
          </div>}
        </div>
      )}

      <div className="mt-4 border-t border-denon-border/50 pt-3">
        <button
          onClick={() => {
            const nextOpen = !queueOpen
            setQueueOpen(nextOpen)
            if (nextOpen) void loadQueue()
          }}
          className="w-full flex items-center justify-between text-xs text-denon-muted hover:text-denon-text transition-colors"
          aria-expanded={queueOpen}
        >
          <span className="uppercase tracking-wider">Queue {queue.length > 0 ? `(${queue.length})` : ''}</span>
          <span aria-hidden="true">{queueOpen ? '▲' : '▼'}</span>
        </button>

        {queueOpen && (
          <div className="mt-3">
            {queueLoading && <p className="text-xs text-denon-muted">Loading queue...</p>}
            {!queueLoading && queueError && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-denon-muted">Queue unavailable</p>
                <button
                  onClick={() => void loadQueue()}
                  className="text-xs text-denon-gold hover:text-denon-text"
                >
                  Retry
                </button>
              </div>
            )}
            {!queueLoading && !queueError && queue.length === 0 && (
              <p className="text-xs text-denon-muted">No queue for this source</p>
            )}
            {!queueLoading && !queueError && queue.length > 0 && (
              <ol className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {queue.map((item, index) => (
                  <li key={item.qid ?? `${item.song}-${index}`} className="flex gap-2 min-w-0">
                    <span className="w-5 shrink-0 text-right text-xs text-denon-muted">{index + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-denon-text truncate">{item.song || 'Unknown title'}</p>
                      {(item.artist || item.album) && (
                        <p className="text-[10px] text-denon-muted truncate">{item.artist || item.album}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      <ServerBrowser active={source === 'SERVER'} />
      <NavidromeBrowser active={source === 'SERVER'} />

      {onRadioFavoriteChange && (
        <RadioBrowser
          open={radioOpen}
          onClose={() => setRadioOpen(false)}
          favorites={radioFavorites}
          onFavoriteChange={onRadioFavoriteChange}
        />
      )}
    </div>
  )
}
