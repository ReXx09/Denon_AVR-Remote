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

  useEffect(() => {
    if (!open) return
    fetch('/api/v1/media/navidrome/status')
      .then(response => response.ok ? response.json() as Promise<{ configured?: boolean }> : Promise.reject())
      .then(data => setNavidromeConfigured(Boolean(data.configured)))
      .catch(() => setNavidromeConfigured(false))
  }, [open])

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

            <p className="mt-4 text-xs leading-relaxed text-denon-muted">
              Optional connections can be configured in the deployment settings. Changes may require a container restart.
            </p>
            <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl bg-denon-surface px-4 py-2 text-sm font-medium text-denon-text hover:bg-denon-border/70">Close</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
