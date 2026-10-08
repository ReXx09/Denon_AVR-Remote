import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DeviceInfo, ReceiverState } from '../types'

interface Props {
  state: ReceiverState | null | undefined
  info: DeviceInfo | null | undefined
}

export default function SetupMenu({ state, info }: Props) {
  const [open, setOpen] = useState(false)
  const [navidromeConfigured, setNavidromeConfigured] = useState<boolean | null>(null)
  const [navidromeUrl, setNavidromeUrl] = useState('')
  const [navidromeUsername, setNavidromeUsername] = useState('')
  const [navidromePassword, setNavidromePassword] = useState('')
  const [hasNavidromePassword, setHasNavidromePassword] = useState(false)
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
    ])
      .then(async ([statusResponse, settingsResponse]) => {
        if (!statusResponse.ok || !settingsResponse.ok) throw new Error()
        return await Promise.all([
          statusResponse.json() as Promise<{ configured?: boolean }>,
          settingsResponse.json() as Promise<{ url?: string; username?: string; has_password?: boolean }>,
        ])
      })
      .then(([status, saved]) => {
        setNavidromeConfigured(Boolean(status.configured))
        setNavidromeUrl(saved.url || '')
        setNavidromeUsername(saved.username || '')
        setHasNavidromePassword(Boolean(saved.has_password))
      })
      .catch(() => {
        setNavidromeConfigured(false)
        setSetupError('Could not load setup settings')
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

            <div className="mt-5 border-t border-denon-border/50 pt-4">
              <div className="mb-3">
                <h3 className="text-sm font-medium text-denon-text">Navidrome</h3>
                <p className="mt-1 text-xs text-denon-muted">Configure the optional music library connection.</p>
              </div>
              <div className="space-y-3">
                <label className="block text-xs text-denon-muted">
                  Server URL
                  <input value={navidromeUrl} onChange={event => setNavidromeUrl(event.target.value)} placeholder="http://navidrome:4533" className="mt-1 w-full rounded-lg border border-denon-border bg-denon-surface px-3 py-2 text-sm text-denon-text outline-none focus:border-denon-gold" />
                </label>
                <label className="block text-xs text-denon-muted">
                  Username
                  <input value={navidromeUsername} onChange={event => setNavidromeUsername(event.target.value)} autoComplete="username" className="mt-1 w-full rounded-lg border border-denon-border bg-denon-surface px-3 py-2 text-sm text-denon-text outline-none focus:border-denon-gold" />
                </label>
                <label className="block text-xs text-denon-muted">
                  Password {hasNavidromePassword && <span className="text-denon-green">(saved)</span>}
                  <input type="password" value={navidromePassword} onChange={event => setNavidromePassword(event.target.value)} autoComplete="new-password" placeholder={hasNavidromePassword ? 'Leave blank to keep saved password' : ''} className="mt-1 w-full rounded-lg border border-denon-border bg-denon-surface px-3 py-2 text-sm text-denon-text outline-none focus:border-denon-gold" />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void saveNavidrome()} disabled={saving} className="flex-1 rounded-lg bg-denon-gold px-3 py-2 text-sm font-medium text-denon-dark hover:brightness-110 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => void testNavidrome()} disabled={testing || !navidromeConfigured} className="flex-1 rounded-lg bg-denon-surface px-3 py-2 text-sm font-medium text-denon-text hover:bg-denon-border/70 disabled:opacity-50">{testing ? 'Testing...' : 'Test connection'}</button>
              </div>
              {setupMessage && <p className="mt-3 text-xs text-denon-green">{setupMessage}</p>}
              {setupError && <p className="mt-3 text-xs text-denon-red">{setupError}</p>}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl bg-denon-surface px-4 py-2 text-sm font-medium text-denon-text hover:bg-denon-border/70">Close</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
