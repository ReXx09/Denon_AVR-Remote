import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DeviceInfo, ReceiverState } from '../types'

interface Props {
  state: ReceiverState | null | undefined
  info: DeviceInfo | null | undefined
}

function isValidReceiverHost(host: string): boolean {
  if (!host.trim()) return true
  const parts = host.trim().split('.')
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

export default function SetupMenu({ state, info }: Props) {
  const [open, setOpen] = useState(false)
  const [navidromeConfigured, setNavidromeConfigured] = useState<boolean | null>(null)
  const [musicServerName, setMusicServerName] = useState('Music server')
  const [navidromeUrl, setNavidromeUrl] = useState('')
  const [navidromeUsername, setNavidromeUsername] = useState('')
  const [navidromePassword, setNavidromePassword] = useState('')
  const [hasNavidromePassword, setHasNavidromePassword] = useState(false)
  const [receiverHost, setReceiverHost] = useState('')
  const [telnetPort, setTelnetPort] = useState(23)
  const [heosPort, setHeosPort] = useState(1255)
  const [heosSources, setHeosSources] = useState(true)
  const [heosAccount, setHeosAccount] = useState<boolean | null>(null)
  const [heosAccountName, setHeosAccountName] = useState<string | null>(null)
  const [heosServices, setHeosServices] = useState<string[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ navidrome: true, receiver: false, heos: false })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [setupMessage, setSetupMessage] = useState('')
  const [setupError, setSetupError] = useState('')

  useEffect(() => {
    if (!open) return
    setSetupMessage('')
    setSetupError('')
    Promise.all([
      fetch('/api/v1/media/navidrome/status'),
      fetch('/api/v1/media/navidrome/settings'),
      fetch('/api/v1/setup/settings'),
    ])
      .then(async ([statusResponse, settingsResponse, setupResponse]) => {
        if (!statusResponse.ok || !settingsResponse.ok || !setupResponse.ok) throw new Error()
        return await Promise.all([
          statusResponse.json() as Promise<{ configured?: boolean; service_name?: string }>,
          settingsResponse.json() as Promise<{ service_name?: string; url?: string; username?: string; has_password?: boolean }>,
          setupResponse.json() as Promise<{ receiver?: { host?: string; telnet_port?: number; heos_port?: number; heos_sources?: boolean } }>,
        ])
      })
      .then(([status, saved, setup]) => {
        setNavidromeConfigured(Boolean(status.configured))
        setMusicServerName(saved.service_name || status.service_name || 'Music server')
        setNavidromeUrl(saved.url || '')
        setNavidromeUsername(saved.username || '')
        setHasNavidromePassword(Boolean(saved.has_password))
        setReceiverHost(setup.receiver?.host || '')
        setTelnetPort(setup.receiver?.telnet_port || 23)
        setHeosPort(setup.receiver?.heos_port || 1255)
        setHeosSources(setup.receiver?.heos_sources ?? true)
      })
      .catch(() => {
        setNavidromeConfigured(false)
        setSetupError('Could not load setup settings')
      })
  }, [open])

  useEffect(() => {
    if (!open) return
    Promise.all([fetch('/api/v1/media/radio/status'), fetch('/api/v1/media/heos/services')])
      .then(async ([statusResponse, servicesResponse]) => {
        if (!statusResponse.ok || !servicesResponse.ok) throw new Error()
        return await Promise.all([
          statusResponse.json() as Promise<{ account_signed_in?: boolean; username?: string | null }>,
          servicesResponse.json() as Promise<{ services?: { name?: string }[] }>,
        ])
      })
      .then(([data, serviceData]) => {
        setHeosAccount(Boolean(data.account_signed_in))
        setHeosAccountName(data.username || null)
        setHeosServices((serviceData.services || []).map(service => service.name).filter((name): name is string => Boolean(name)))
      })
      .catch(() => {
        setHeosAccount(false)
        setHeosAccountName(null)
        setHeosServices([])
      })
  }, [open])

  const saveNavidrome = async () => {
    setSaving(true)
    setSetupMessage('')
    setSetupError('')
    try {
      const response = await fetch('/api/v1/media/navidrome/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_name: musicServerName,
          url: navidromeUrl,
          username: navidromeUsername,
          password: navidromePassword || undefined,
        }),
      })
      const data = await response.json() as { configured?: boolean; detail?: string }
      if (!response.ok) throw new Error(data.detail || 'Could not save settings')
      setNavidromePassword('')
      setHasNavidromePassword(Boolean(navidromeUsername && data.configured))
      setNavidromeConfigured(Boolean(data.configured))
      setSetupMessage('Navidrome settings saved')
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  const testNavidrome = async () => {
    setTesting(true)
    setSetupMessage('')
    setSetupError('')
    try {
      const response = await fetch('/api/v1/media/navidrome/test', { method: 'POST' })
      const data = await response.json() as { detail?: string }
      if (!response.ok) throw new Error(data.detail || 'Connection failed')
      setNavidromeConfigured(true)
      setSetupMessage('Navidrome connection successful')
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Connection failed')
    } finally {
      setTesting(false)
    }
  }

  const saveReceiver = async () => {
    setSaving(true)
    setSetupMessage('')
    setSetupError('')
    try {
      const response = await fetch('/api/v1/setup/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: receiverHost, telnet_port: telnetPort, heos_port: heosPort, heos_sources: heosSources }),
      })
      const data = await response.json() as { detail?: string; reconnected?: boolean; restart_required?: boolean }
      if (!response.ok) throw new Error(data.detail || 'Could not save receiver settings')
      setSetupMessage(data.restart_required ? 'Saved. Restart required for discovery mode.' : data.reconnected ? 'Saved and receiver reconnected' : 'Receiver settings saved')
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Could not save receiver settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpanded(current => ({ ...current, [section]: !current[section] }))
  }

  const navidromeHasValues = Boolean(navidromeUrl.trim() || navidromeUsername.trim() || navidromePassword)
  const navidromeValidation = navidromeHasValues
    ? !/^https?:\/\//i.test(navidromeUrl.trim())
      ? 'Use a complete URL starting with http:// or https://.'
      : !navidromeUsername.trim()
        ? 'Enter the Navidrome username.'
        : !navidromePassword && !hasNavidromePassword
          ? 'Enter the password or leave Navidrome empty to disable it.'
          : ''
    : ''
  const receiverValidation = !isValidReceiverHost(receiverHost)
    ? 'Receiver IP must be a valid IPv4 address or empty for auto-discovery.'
    : !isValidPort(telnetPort) || !isValidPort(heosPort)
      ? 'Ports must be whole numbers between 1 and 65535.'
      : ''

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-8 w-8 rounded-lg text-denon-muted hover:bg-denon-surface hover:text-denon-text transition-colors"
        aria-label="Open setup"
        title="Setup"
      >
        <span aria-hidden="true">⚙</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="setup-title">
          <div className="w-full max-w-md rounded-2xl border border-denon-border bg-denon-card p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 id="setup-title" className="text-base font-semibold text-denon-text">Setup</h2>
                <p className="mt-1 text-xs text-denon-muted">Connections and optional services</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg text-denon-muted hover:bg-denon-surface hover:text-denon-text" aria-label="Close setup">×</button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-denon-surface/60 px-3 py-2.5">
                <span className="text-denon-muted">Receiver</span>
                <span className={state?.connected ? 'text-denon-green' : 'text-denon-red'}>{state?.connected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-denon-surface/60 px-3 py-2.5">
                <span className="text-denon-muted">HEOS</span>
                <span className="text-denon-green">Built in</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-denon-surface/60 px-3 py-2.5">
                <span className="text-denon-muted">Navidrome</span>
                <span className={navidromeConfigured ? 'text-denon-green' : 'text-denon-muted'}>
                  {navidromeConfigured === null ? 'Checking...' : navidromeConfigured ? 'Configured' : 'Not configured'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-denon-surface/60 px-3 py-2.5">
                <span className="text-denon-muted">Receiver IP</span>
                <span className="font-mono text-xs text-denon-text">{info?.receiver_ip || '—'}</span>
              </div>
            </div>

            <div className="mt-5 border-t border-denon-border/50 pt-3">
              <button type="button" onClick={() => toggleSection('navidrome')} className="flex w-full items-center justify-between py-2 text-left">
                <span><span className="block text-sm font-medium text-denon-text">Navidrome</span><span className="mt-1 block text-xs text-denon-muted">Optional music library connection</span></span>
                <span className="text-denon-muted" aria-hidden="true">{expanded.navidrome ? '▲' : '▼'}</span>
              </button>
              {expanded.navidrome && <div className="pt-3">
                <div className="space-y-3">
                  <label className="block text-xs text-denon-muted">Service name<input value={musicServerName} onChange={event => setMusicServerName(event.target.value)} placeholder="Music server" className="mt-1 w-full rounded-lg border border-denon-border bg-denon-surface px-3 py-2 text-sm text-denon-text outline-none focus:border-denon-gold" /></label>
                  <label className="block text-xs text-denon-muted">Server URL<input value={navidromeUrl} onChange={event => setNavidromeUrl(event.target.value)} placeholder="http://navidrome:4533" className="mt-1 w-full rounded-lg border border-denon-border bg-denon-surface px-3 py-2 text-sm text-denon-text outline-none focus:border-denon-gold" /></label>
                  <label className="block text-xs text-denon-muted">Username<input value={navidromeUsername} onChange={event => setNavidromeUsername(event.target.value)} autoComplete="username" className="mt-1 w-full rounded-lg border border-denon-border bg-denon-surface px-3 py-2 text-sm text-denon-text outline-none focus:border-denon-gold" /></label>
                  <label className="block text-xs text-denon-muted">Password {hasNavidromePassword && <span className="text-denon-green">(saved)</span>}<input type="password" value={navidromePassword} onChange={event => setNavidromePassword(event.target.value)} autoComplete="new-password" placeholder={hasNavidromePassword ? 'Leave blank to keep saved password' : ''} className="mt-1 w-full rounded-lg border border-denon-border bg-denon-surface px-3 py-2 text-sm text-denon-text outline-none focus:border-denon-gold" /></label>
                </div>
                {navidromeValidation && <p className="mt-3 rounded-lg bg-denon-red/10 px-3 py-2 text-xs text-denon-red">{navidromeValidation}</p>}
                {!navidromeHasValues && <p className="mt-3 rounded-lg bg-denon-surface px-3 py-2 text-xs text-denon-muted">Optional. Leave all fields empty to keep Navidrome disabled.</p>}
                {navidromeHasValues && !navidromeValidation && <p className="mt-3 rounded-lg bg-denon-green/10 px-3 py-2 text-xs text-denon-green">Configuration looks complete. Save it, then test the connection.</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void saveNavidrome()} disabled={saving || Boolean(navidromeValidation)} className="flex-1 rounded-lg bg-denon-gold px-3 py-2 text-sm font-medium text-denon-dark hover:brightness-110 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
                  <button type="button" onClick={() => void testNavidrome()} disabled={testing || !navidromeConfigured || Boolean(navidromeValidation)} className="flex-1 rounded-lg bg-denon-surface px-3 py-2 text-sm font-medium text-denon-text hover:bg-denon-border/70 disabled:opacity-50">{testing ? 'Testing...' : 'Test connection'}</button>
                </div>
              </div>}
            </div>

            <div className="border-t border-denon-border/50 pt-3">
              <button type="button" onClick={() => toggleSection('receiver')} className="flex w-full items-center justify-between py-2 text-left">
                <span><span className="block text-sm font-medium text-denon-text">Receiver</span><span className="mt-1 block text-xs text-denon-muted">Network address and control ports</span></span>
                <span className="text-denon-muted" aria-hidden="true">{expanded.receiver ? '▲' : '▼'}</span>
              </button>
              {expanded.receiver && <div className="space-y-3 pt-3">
                <label className="block text-xs text-denon-muted">Receiver IP<input value={receiverHost} onChange={event => setReceiverHost(event.target.value)} placeholder="Empty for auto-discovery" className="mt-1 w-full rounded-lg border border-denon-border bg-denon-surface px-3 py-2 font-mono text-sm text-denon-text outline-none focus:border-denon-gold" /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs text-denon-muted">Telnet port<input type="number" min="1" max="65535" value={telnetPort} onChange={event => setTelnetPort(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-denon-border bg-denon-surface px-3 py-2 text-sm text-denon-text outline-none focus:border-denon-gold" /></label>
                  <label className="block text-xs text-denon-muted">HEOS port<input type="number" min="1" max="65535" value={heosPort} onChange={event => setHeosPort(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-denon-border bg-denon-surface px-3 py-2 text-sm text-denon-text outline-none focus:border-denon-gold" /></label>
                </div>
                {receiverValidation && <p className="rounded-lg bg-denon-red/10 px-3 py-2 text-xs text-denon-red">{receiverValidation}</p>}
                {!receiverValidation && <p className="rounded-lg bg-denon-green/10 px-3 py-2 text-xs text-denon-green">Receiver settings look valid. Saving a new IP reconnects immediately.</p>}
                <button type="button" onClick={() => void saveReceiver()} disabled={saving || Boolean(receiverValidation)} className="w-full rounded-lg bg-denon-gold px-3 py-2 text-sm font-medium text-denon-dark hover:brightness-110 disabled:opacity-50">{saving ? 'Saving...' : 'Save receiver settings'}</button>
              </div>}
            </div>

            <div className="border-t border-denon-border/50 pt-3">
              <button type="button" onClick={() => toggleSection('heos')} className="flex w-full items-center justify-between py-2 text-left">
                <span><span className="block text-sm font-medium text-denon-text">HEOS</span><span className="mt-1 block text-xs text-denon-muted">Network source visibility</span></span>
                <span className="text-denon-muted" aria-hidden="true">{expanded.heos ? '▲' : '▼'}</span>
              </button>
              {expanded.heos && <div className="pt-3">
                <div className="mb-3 rounded-lg bg-denon-surface px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-denon-muted">HEOS account</span>
                    <span className={heosAccount ? 'text-denon-green' : heosAccount === null ? 'text-denon-muted' : 'text-denon-red'}>{heosAccount === null ? 'Checking...' : heosAccount ? 'Signed in' : 'Not signed in'}</span>
                  </div>
                  {heosAccountName && <p className="mt-1 truncate text-xs text-denon-text">{heosAccountName}</p>}
                </div>
                <div className="mb-3 rounded-lg bg-denon-surface px-3 py-2.5 text-xs">
                  <p className="text-denon-muted">Services reported by receiver</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {heosServices.length > 0 ? heosServices.map(service => <span key={service} className="rounded-full bg-denon-green/10 px-2 py-1 text-denon-green">{service}</span>) : <span className="text-denon-muted">No services detected yet</span>}
                  </div>
                </div>
                <label className="flex items-center justify-between rounded-lg bg-denon-surface px-3 py-2.5 text-sm text-denon-text">Show HEOS sources<input type="checkbox" checked={heosSources} onChange={event => setHeosSources(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /></label>
                <p className="mt-2 text-xs leading-relaxed text-denon-muted">HEOS uses the port configured under Receiver. Sign in to your HEOS account in the HEOS app on the same network; the receiver then makes the account available here. Login credentials are not sent through the dashboard.</p>
                <button type="button" onClick={() => void saveReceiver()} disabled={saving} className="mt-3 w-full rounded-lg bg-denon-gold px-3 py-2 text-sm font-medium text-denon-dark hover:brightness-110 disabled:opacity-50">{saving ? 'Saving...' : 'Save HEOS settings'}</button>
              </div>}
            </div>
            {setupMessage && <p className="mt-3 text-xs text-denon-green">{setupMessage}</p>}
            {setupError && <p className="mt-3 text-xs text-denon-red">{setupError}</p>}
            <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl bg-denon-surface px-4 py-2 text-sm font-medium text-denon-text hover:bg-denon-border/70">Close</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
