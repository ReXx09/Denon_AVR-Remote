import { useState, useEffect, memo } from 'react'
import { getTheme, applyTheme } from './theme'
import { useWebSocket } from './hooks/useWebSocket'
import ReceiverSetup from './components/ReceiverSetup'
import { useDeviceInfo } from './hooks/useDeviceInfo'
import { useApi } from './hooks/useApi'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useForegroundEffects } from './hooks/useForegroundEffects'
import StatusBar from './components/StatusBar'
import PowerControl from './components/PowerControl'
import VolumeControl from './components/VolumeControl'
import SourceSelector from './components/SourceSelector'
import SurroundMode from './components/SurroundMode'
import ChannelLevels from './components/ChannelLevels'
import ToneControls from './components/ToneControls'
import SubwooferLevel from './components/SubwooferLevel'
import AudioSettings from './components/AudioSettings'
import InputProfiles from './components/InputProfiles'
import RadioBrowser from './components/RadioBrowser'
import AudioDiagnostics from './components/AudioDiagnostics'
import MediaControls from './components/MediaControls'
import Zone2Controls from './components/Zone2Controls'
import Zone3Controls from './components/Zone3Controls'
import CacheReset from './components/CacheReset'
import AmbientBackground from './experience/AmbientBackground'
import SeasonalEffects from './experience/SeasonalEffects'
import ShortcutOverlay from './experience/ShortcutOverlay'
import type { Zone, ThemeName, UiEffects, RadioFavorite } from './types'

type Section = 'controls' | 'audio' | 'profiles' | 'heos'

// Fallback channel names if API hasn't loaded yet
const FALLBACK_CHANNEL_NAMES: Record<string, string> = {
  FL: 'Front L', FR: 'Front R', C: 'Center', SW: 'Subwoofer',
  SW2: 'Sub 2', SL: 'Surround L', SR: 'Surround R',
  SBL: 'SB Left', SBR: 'SB Right', SB: 'SB',
  FHL: 'Height L', FHR: 'Height R',
  FWL: 'Wide L', FWR: 'Wide R',
  TFL: 'Top F.L', TFR: 'Top F.R', TML: 'Top M.L', TMR: 'Top M.R',
  TRL: 'Top R.L', TRR: 'Top R.R',
}

function readZoneVolumeLimit(key: string): number {
  try {
    const stored = localStorage.getItem(key)
    const value = stored == null ? 98 : Number(stored)
    return Number.isInteger(value) && value >= 0 && value <= 98 ? value : 98
  } catch {
    return 98
  }
}

// Memoize heavy child components to avoid re-renders on every WebSocket push
const MemoChannelLevels = memo(ChannelLevels)
const MemoAudioSettings = memo(AudioSettings)
const MemoSourceSelector = memo(SourceSelector)
const MemoVolumeControl = memo(VolumeControl)
const MemoPowerControl = memo(PowerControl)
const MemoStatusBar = memo(StatusBar)
const MemoMediaControls = memo(MediaControls)

export default function App() {
  const { state, wsConnected, wsConnecting, sendCommand } = useWebSocket()
  const { info, reload: reloadDeviceInfo } = useDeviceInfo()
  const { post } = useApi()
  const [zone, setZone] = useState<Zone>('main')
  const [zone2VolumeMax, setZone2VolumeMax] = useState(() => readZoneVolumeLimit('denon-zone2-volume-max'))
  const [zone3VolumeMax, setZone3VolumeMax] = useState(() => readZoneVolumeLimit('denon-zone3-volume-max'))
  useForegroundEffects()
  useKeyboardShortcuts({ state, post, sendCommand, zone, setZone })
  const [activeSection, setActiveSection] = useState<Section>('controls')
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('gold')

  // Apply theme whenever device info loads. Server-persisted theme is the default;
  // localStorage remains a browser-local override for users who want it.
  useEffect(() => {
    const t = getTheme(info?.theme)
    applyTheme(t)
    setCurrentTheme(t)
  }, [info?.theme])

  // Live theme sync: the backend includes the persisted theme in every WebSocket
  // state push and re-broadcasts on save, so a theme change on one device applies
  // on all connected devices without a reload.
  useEffect(() => {
    if (!state?.theme) return
    const t = getTheme(state.theme)
    applyTheme(t)
    setCurrentTheme(t)
  }, [state?.theme])

  // Loading — waiting for first WebSocket message
  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-denon-dark">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-denon-gold/30 border-t-denon-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="text-denon-muted text-sm">Connecting…</p>
          <p className="text-denon-muted/50 text-xs mt-2">If this stays here, hard refresh once to clear old cached app files.</p>
        </div>
      </div>
    )
  }

  // Actively discovering — show spinner (backend will push state update when done)
  if (!state.connected && state.discovering) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-denon-dark p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-denon-card border border-denon-border flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-denon-gold animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <div>
            <p className="text-denon-text font-semibold">Searching for receiver…</p>
            <p className="text-denon-muted text-sm mt-1">Scanning your network for Denon / Marantz AVRs</p>
          </div>
          <div className="flex justify-center gap-1.5 pt-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-denon-gold animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Discovery finished but no receiver found — show setup screen
  if (!state.connected) {
    const reason = info?.receiver_ip === '0.0.0.0' ? 'no_host' : 'connect_failed'
    return <ReceiverSetup reason={reason} onConnect={() => window.location.reload()} currentTheme={currentTheme} onThemeChange={setCurrentTheme} />
  }

  // Connected
  const deviceName = info?.device_name || 'Denon AVR'
  const zoneName = info?.zone1_name || 'Main Zone'
  const z2Name = info?.zone2_name || 'Zone 2'
  const z3Name = info?.zone3_name || 'Zone 3'
  const channelNames = (info?.channel_names && Object.keys(info.channel_names).length > 0)
    ? info.channel_names
    : FALLBACK_CHANNEL_NAMES
  const sourceNameMap = info?.source_name_map || {}
  const sourceNameOverrides = info?.source_name_overrides || {}
  const sourceFavorites = info?.source_favorites || []
  const sourceDisabled = info?.source_disabled || []
  const configuredSources = info?.sources || []
  const radioFavorites = info?.radio_favorites || []
  const uiEffects: Partial<UiEffects> = info?.ui_effects || {}

  const saveRadioFavorite = async (favorite: RadioFavorite, enabled: boolean): Promise<void> => {
    const res = enabled
      ? await fetch('/api/v1/media/radio/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(favorite),
        })
      : await fetch(`/api/v1/media/radio/favorites/${encodeURIComponent(favorite.mid)}`, { method: 'DELETE' })
    if (res.ok) reloadDeviceInfo()
    else console.warn('Radio favorite update failed', await res.text().catch(() => res.statusText))
  }

  const renameSource = async (code: string, name: string | null): Promise<void> => {
    const res = name == null
      ? await fetch(`/api/v1/source-names/${encodeURIComponent(code)}`, { method: 'DELETE' })
      : await fetch(`/api/v1/source-names/${encodeURIComponent(code)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
    if (res.ok) reloadDeviceInfo()
    else console.warn('Source rename failed', await res.text().catch(() => res.statusText))
  }

  const saveSourceFavorite = async (code: string, enabled: boolean): Promise<void> => {
    const res = enabled
      ? await fetch('/api/v1/source-favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: code }),
        })
      : await fetch(`/api/v1/source-favorites/${encodeURIComponent(code)}`, { method: 'DELETE' })
    if (res.ok) reloadDeviceInfo()
    else console.warn('Source favorite update failed', await res.text().catch(() => res.statusText))
  }

  const saveSourceDisabled = async (codes: string[]): Promise<void> => {
    const res = await fetch('/api/v1/source-disabled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: codes }),
    })
    if (res.ok) reloadDeviceInfo()
    else console.warn('Source visibility update failed', await res.text().catch(() => res.statusText))
  }

  const saveZoneVolumeMax = (targetZone: 'zone2' | 'zone3', value: number) => {
    const key = targetZone === 'zone2' ? 'denon-zone2-volume-max' : 'denon-zone3-volume-max'
    if (targetZone === 'zone2') setZone2VolumeMax(value)
    else setZone3VolumeMax(value)
    try { localStorage.setItem(key, String(value)) } catch { /* Keep the in-memory setting if storage is unavailable. */ }
  }

  const mainSections: { id: Section; label: string }[] = [
    { id: 'controls', label: 'Controls' },
    { id: 'audio', label: 'Audio' },
    { id: 'profiles', label: 'Profiles' },
    { id: 'heos', label: 'HEOS' },
  ]

  return (
    <>
    {uiEffects.ambient_background !== false && (
      <AmbientBackground state={state} intensity={uiEffects.ambient_intensity ?? 1} />
    )}
    <SeasonalEffects mode={uiEffects.seasonal_effects || 'auto'} />
    {uiEffects.shortcut_overlay !== false && <ShortcutOverlay />}
    <CacheReset />
    <div className={`relative z-10 max-w-4xl mx-auto px-4 pb-24 sm:pb-8 min-h-screen ${uiEffects.card_animations === false ? 'no-card-animations' : ''}`}>
      {/* Header + Health */}
      <MemoStatusBar
        deviceName={deviceName}
        state={state}
        wsConnected={wsConnected}
        wsConnecting={wsConnecting}
        receiverIp={info?.receiver_ip}
        info={info}
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
      />

      {/* Zone Selector (desktop; mobile uses the bottom nav) */}
      <div className="hidden sm:flex gap-0 mb-5 bg-denon-card/50 rounded-2xl p-1.5 border border-denon-border/50 backdrop-blur-sm">
        <button
          onClick={() => setZone('main')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
            zone === 'main'
              ? 'bg-gradient-to-r from-denon-gold to-amber-500 text-denon-dark shadow-lg shadow-denon-gold/25'
              : 'text-denon-muted hover:text-denon-text'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            {zoneName}
          </span>
        </button>
        <button
          onClick={() => setZone(zone === 'zone3' ? 'zone3' : 'zone2')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
            zone === 'zone2' || zone === 'zone3'
              ? 'bg-gradient-to-r from-denon-gold to-amber-500 text-denon-dark shadow-lg shadow-denon-gold/25'
              : 'text-denon-muted hover:text-denon-text'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
            Zone 2/3
          </span>
        </button>
      </div>

      {/* Main Zone */}
      {zone === 'main' && (
        <>
          {/* Section tabs (desktop; mobile uses the bottom nav) */}
          <div className="hidden sm:flex gap-1 mb-4">
            {mainSections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeSection === s.id
                    ? 'bg-denon-surface text-denon-gold border border-denon-gold/30'
                    : 'text-denon-muted hover:text-denon-text'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="space-y-4 fade-in" key={activeSection}>
            {activeSection === 'controls' && (
              <>
                <MemoPowerControl state={state} sendCommand={sendCommand} zone="main" />
                <MemoVolumeControl
                  state={state}
                  sendCommand={sendCommand}
                  post={post}
                  zone2VolumeMax={zone2VolumeMax}
                  zone3VolumeMax={zone3VolumeMax}
                />
                <MemoMediaControls
                  state={state}
                  sendCommand={sendCommand}
                  post={post}
                  radioFavorites={radioFavorites}
                  onRadioFavoriteChange={saveRadioFavorite}
                  sourceFavorites={sourceFavorites}
                  onSourceFavoriteChange={saveSourceFavorite}
                />
                <MemoSourceSelector
                  state={state}
                  sendCommand={sendCommand}
                  sources={configuredSources}
                  sourceNameMap={sourceNameMap}
                  sourceNameOverrides={sourceNameOverrides}
                  sourceFavorites={sourceFavorites}
                  onSourceFavoriteChange={saveSourceFavorite}
                  sourceDisabled={sourceDisabled}
                  onSourceDisabledChange={saveSourceDisabled}
                  radioFavorites={radioFavorites}
                  onRenameSource={renameSource}
                  onRadioFavoriteChange={saveRadioFavorite}
                />
                <SurroundMode state={state} sendCommand={sendCommand} />
              </>
            )}

            {activeSection === 'audio' && (
              <>
                <AudioDiagnostics state={state} />
                <MemoChannelLevels
                  channels={state.channel_volumes || {}}
                  channelNames={channelNames}
                  sendCommand={sendCommand}
                  post={post}
                  calibration={state.speaker_calibration}
                />
                <SubwooferLevel state={state} post={post} />
                <ToneControls state={state} post={post} />
                <MemoAudioSettings state={state} post={post} />
              </>
            )}

            {activeSection === 'profiles' && (
              <>
                <InputProfiles sources={configuredSources} state={state} channelNames={channelNames} />
              </>
            )}

            {activeSection === 'heos' && (
              <div className="space-y-3">
                <div>
                  <h2 className="text-xs font-medium text-denon-muted uppercase tracking-wider">HEOS Radio</h2>
                </div>
                <RadioBrowser
                  open
                  onClose={() => {}}
                  favorites={radioFavorites}
                  onFavoriteChange={saveRadioFavorite}
                  inline
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Zone 2 / Zone 3 */}
      {(zone === 'zone2' || zone === 'zone3') && (
        <div className="fade-in">
          <div className="card mb-4 p-1.5">
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setZone('zone2')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                  zone === 'zone2'
                    ? 'bg-denon-surface text-denon-gold border border-denon-gold/30'
                    : 'text-denon-muted hover:text-denon-text'
                }`}
              >
                {z2Name}
              </button>
              <button
                onClick={() => setZone('zone3')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                  zone === 'zone3'
                    ? 'bg-denon-surface text-denon-gold border border-denon-gold/30'
                    : 'text-denon-muted hover:text-denon-text'
                }`}
              >
                {z3Name}
              </button>
            </div>
          </div>
          {zone === 'zone2' && <Zone2Controls
            state={state}
            sendCommand={sendCommand}
            post={post}
            volumeMax={zone2VolumeMax}
            onVolumeMaxChange={value => saveZoneVolumeMax('zone2', value)}
            sources={configuredSources}
            sourceNameMap={sourceNameMap}
            sourceNameOverrides={sourceNameOverrides}
            sourceDisabled={sourceDisabled}
            onSourceDisabledChange={saveSourceDisabled}
            radioFavorites={radioFavorites}
            onRenameSource={renameSource}
            onRadioFavoriteChange={saveRadioFavorite}
            zoneName={z2Name}
          />}
          {zone === 'zone3' && <Zone3Controls
            state={state}
            sendCommand={sendCommand}
            post={post}
            volumeMax={zone3VolumeMax}
            onVolumeMaxChange={value => saveZoneVolumeMax('zone3', value)}
            sources={configuredSources}
            sourceNameMap={sourceNameMap}
            sourceNameOverrides={sourceNameOverrides}
            sourceDisabled={sourceDisabled}
            onSourceDisabledChange={saveSourceDisabled}
            radioFavorites={radioFavorites}
            onRenameSource={renameSource}
            onRadioFavoriteChange={saveRadioFavorite}
          />}
        </div>
      )}

    </div>

    {/* Mobile bottom navigation — thumb-reachable zone + section tabs */}
    <nav
      className="mobile-bottom-nav sm:hidden fixed inset-x-0 z-40 bg-denon-card/95 backdrop-blur-xl border-t border-denon-border/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-4xl mx-auto px-3 pt-2 pb-2 space-y-2">
        {/* Zone toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setZone('main')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              zone === 'main'
                ? 'bg-gradient-to-r from-denon-gold to-amber-500 text-denon-dark'
                : 'text-denon-muted hover:text-denon-text'
            }`}
          >
            {zoneName}
          </button>
          <button
            onClick={() => setZone(zone === 'zone3' ? 'zone3' : 'zone2')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              zone === 'zone2' || zone === 'zone3'
                ? 'bg-gradient-to-r from-denon-gold to-amber-500 text-denon-dark'
                : 'text-denon-muted hover:text-denon-text'
            }`}
          >
            Zone 2/3
          </button>
        </div>
        {/* Section tabs (main zone only) */}
        {zone === 'main' && (
          <div className="flex gap-1">
            {mainSections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeSection === s.id
                    ? 'bg-denon-surface text-denon-gold border border-denon-gold/30'
                    : 'text-denon-muted hover:text-denon-text'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
    </>
  )
}
