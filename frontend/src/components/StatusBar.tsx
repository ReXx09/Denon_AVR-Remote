import { useEffect, useState } from 'react'
import ThemePicker from './ThemePicker'
import SetupMenu from './SetupMenu'
import type { ReceiverState, DeviceInfo, ThemeName } from '../types'
import { useLanguage } from '../language'

interface Props {
  deviceName?: string
  state: ReceiverState | null | undefined
  info: DeviceInfo | null | undefined
  wsConnected: boolean
  wsConnecting: boolean
  receiverIp?: string | null
  currentTheme: ThemeName
  onThemeChange: (name: ThemeName) => void
}

export default function StatusBar({ deviceName, state, info, wsConnected, wsConnecting, receiverIp, currentTheme, onThemeChange }: Props) {
  const { tr } = useLanguage()
  const [expanded, setExpanded] = useState(false)
  const [health, setHealth] = useState<{
    heos_enabled: boolean
    heos_connected: boolean
    heos_player_available: boolean
    heos_last_response_at: string | null
    heos_last_error: string | null
  } | null>(null)
  const telnetOk = state?.connected
  const power = state?.power
  const ok = telnetOk && (wsConnected || wsConnecting)

  useEffect(() => {
    let active = true
    const loadHealth = async () => {
      try {
        const response = await fetch('/api/v1/health')
        if (!response.ok) throw new Error(`Health request failed: ${response.status}`)
        const data = await response.json()
        if (active) setHealth(data)
      } catch (error) {
        console.warn('Health status unavailable:', error)
      }
    }

    void loadHealth()
    const timer = setInterval(() => void loadHealth(), 10000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  const heosStatus = health?.heos_enabled === false
    ? tr('Disabled')
    : health?.heos_connected
      ? health.heos_player_available ? tr('Connected') : `${tr('Connected')} · ${tr('No player')}`
      : health ? tr('Unavailable') : tr('Unknown')

  return (
    <div className="pt-5 pb-3">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-denon-text tracking-tight">{deviceName}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-8 w-8 rounded-full text-denon-muted hover:bg-denon-surface hover:text-denon-text transition-colors"
            aria-label={tr('Reload dashboard')}
            title="Reload dashboard"
          >
            <svg className="mx-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
            </svg>
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`${ok ? 'badge-green' : 'badge-red'} cursor-pointer hover:brightness-110 transition-all`}
          >
            <span className={`w-2 h-2 rounded-full ${ok ? 'bg-denon-green animate-pulse' : 'bg-denon-red'}`} />
            {telnetOk ? (wsConnected ? 'Connected' : wsConnecting ? 'Connecting' : 'Connected') : 'Disconnected'}
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <SetupMenu state={state} info={info} />
          <ThemePicker currentTheme={currentTheme} onThemeChange={onThemeChange} />
        </div>
      </div>

      {expanded && (
        <div className="mt-2 p-3 bg-denon-surface/50 rounded-xl border border-denon-border/50 text-xs space-y-1.5 fade-in">
          <div className="flex justify-between">
            <span className="text-denon-muted">{tr('Receiver IP')}</span>
            <span className="text-denon-text font-mono">{receiverIp || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-denon-muted">{tr('Telnet Connection')}</span>
            <span className={telnetOk ? 'text-denon-green' : 'text-denon-red'}>
              {telnetOk ? '● Connected' : '● Disconnected'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-denon-muted">{tr('WebSocket')}</span>
            <span className={wsConnected ? 'text-denon-green' : wsConnecting ? 'text-denon-gold' : 'text-denon-muted'}>
              {wsConnected ? '● Connected' : wsConnecting ? '● Connecting' : '● HTTP fallback'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-denon-muted">{tr('HEOS Connection')}</span>
            <span className={health?.heos_connected ? 'text-denon-green' : health?.heos_enabled === false ? 'text-denon-muted' : 'text-denon-red'}>
              {health?.heos_connected ? '● ' : health?.heos_enabled === false ? '' : '● '}{heosStatus}
            </span>
          </div>
          {health?.heos_last_response_at && (
            <div className="flex justify-between">
              <span className="text-denon-muted">{tr('Last HEOS response')}</span>
              <span className="text-denon-text">
                {new Date(health.heos_last_response_at).toLocaleTimeString()}
              </span>
            </div>
          )}
          {!health?.heos_connected && health?.heos_last_error && (
            <p className="break-words text-[10px] text-denon-red/80">{health.heos_last_error}</p>
          )}
          <div className="flex justify-between">
            <span className="text-denon-muted">{tr('Power State')}</span>
            <span className="text-denon-text">{power === true ? 'On' : power === false ? 'Standby' : 'Unknown'}</span>
          </div>
          {state?.surround_mode && (
            <div className="flex justify-between">
              <span className="text-denon-muted">{tr('Surround Mode')}</span>
              <span className="text-denon-text">{state.surround_mode}</span>
            </div>
          )}
          {state?.eco_mode && (
            <div className="flex justify-between">
              <span className="text-denon-muted">{tr('Eco Mode')}</span>
              <span className="text-denon-text">{state.eco_mode}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
