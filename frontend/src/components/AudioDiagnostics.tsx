import type { ReceiverState } from '../types'

interface Props {
  state: ReceiverState
}

function valueOrUnknown(value: string | number | undefined | null): string {
  return value == null || value === '' ? 'Not reported' : String(value)
}

export default function AudioDiagnostics({ state }: Props) {
  const diagnostics = [
    ['Active decoder', valueOrUnknown(state.sound_decoder)],
    ['Surround mode', valueOrUnknown(state.surround_mode)],
    ['Input source', valueOrUnknown(state.source_name || state.source)],
    ['Stream quality', valueOrUnknown(state.stream_quality)],
    ['Sample rate', 'Not reported'],
    ['Input format', 'Not reported'],
    ['Channels', 'Not reported'],
  ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-denon-muted">Audio Diagnostics</h2>
        <span className="text-[10px] uppercase tracking-wider text-denon-muted/70">Read-only</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {diagnostics.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-denon-muted/70">{label}</div>
            <div className={`mt-1 truncate text-xs font-medium ${value === 'Not reported' ? 'text-denon-muted' : 'text-denon-text'}`} title={value}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
