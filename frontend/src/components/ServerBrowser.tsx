import { useEffect, useState } from 'react'

interface ServerItem {
  name?: string
  mid?: string
  cid?: string
  playable?: string
  type?: string
  image_url?: string
}

interface BrowseResult {
  items?: ServerItem[]
  count?: number
}

interface Props {
  active: boolean
}

export default function ServerBrowser({ active }: Props) {
  const [items, setItems] = useState<ServerItem[]>([])
  const [path, setPath] = useState<{ cid?: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState('')

  const load = async (cid?: string) => {
    setLoading(true)
    setError('')
    try {
      const query = cid ? `?cid=${encodeURIComponent(cid)}` : ''
      const response = await fetch(`/api/v1/media/server/browse${query}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json() as BrowseResult
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Server browse failed')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!active) return
    setPath([])
    void load()
  }, [active])

  if (!active) return null

  const openItem = (item: ServerItem) => {
    if (item.playable === 'yes' && item.mid) {
      setPlaying(item.mid)
      void fetch('/api/v1/media/server/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mid: item.mid }),
      }).then(response => {
        if (!response.ok) setError('Could not start item')
      }).catch(() => setError('Could not start item'))
      return
    }
    if (item.cid) {
      setPath(current => [...current, { cid: item.cid, name: item.name || 'Folder' }])
      void load(item.cid)
    }
  }

  const goBack = () => {
    const nextPath = path.slice(0, -1)
    setPath(nextPath)
    void load(nextPath[nextPath.length - 1]?.cid)
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xs font-medium text-denon-muted uppercase tracking-wider">Music Server</h2>
          <p className="text-[10px] text-denon-muted/60">Browse Navidrome or another DLNA server</p>
        </div>
        {path.length > 0 && (
          <button type="button" onClick={goBack} className="btn-ghost text-xs px-2 py-1">Back</button>
        )}
      </div>

      {path.length > 0 && <p className="text-[10px] text-denon-muted mb-2 truncate">{path.map(item => item.name).join(' / ')}</p>}
      {loading && <p className="text-xs text-denon-muted">Loading...</p>}
      {!loading && error && <p className="text-xs text-denon-red">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="text-xs text-denon-muted">No music server items available.</p>}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {items.map((item, index) => {
            const isPlaying = item.mid === playing
            return (
              <button
                key={`${item.mid || item.cid || item.name}-${index}`}
                type="button"
                onClick={() => openItem(item)}
                className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors ${isPlaying ? 'bg-denon-gold/15 text-denon-gold' : 'bg-denon-surface/70 text-denon-text hover:bg-denon-surface'}`}
              >
                <span className="truncate">{item.name || 'Unnamed item'}</span>
                <span className="shrink-0 text-[10px] text-denon-muted">{item.playable === 'yes' ? 'Play' : 'Open'}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
