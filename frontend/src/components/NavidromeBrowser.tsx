import { useEffect, useState } from 'react'

type Artist = { id: string; name: string; albumCount?: number }
type Album = { id: string; name: string; artist?: string; coverArt?: string; songCount?: number }
type Song = { id: string; title: string; artist?: string; album?: string; coverArt?: string; duration?: number }

interface Props {
  active: boolean
}

export default function NavidromeBrowser({ active }: Props) {
  const [configured, setConfigured] = useState(false)
  const [artists, setArtists] = useState<Artist[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [heading, setHeading] = useState('Music server')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const request = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json() as Promise<T>
  }

  useEffect(() => {
    if (!active) return
    setLoading(true)
    void Promise.all([
      request<{ configured: boolean; service_name?: string }>('/api/v1/media/navidrome/status'),
      request<{ indexes?: { index?: { artist?: Artist[] }[] } }>('/api/v1/media/navidrome/indexes'),
    ]).then(([status, data]) => {
      setConfigured(status.configured)
      setHeading(status.service_name || 'Music server')
      setArtists(data.indexes?.index?.flatMap(index => index.artist || []) || [])
      setError('')
    }).catch(() => setError('Navidrome ist nicht erreichbar oder nicht konfiguriert.'))
      .finally(() => setLoading(false))
  }, [active])

  const openArtist = async (artist: Artist) => {
    setLoading(true)
    try {
      const data = await request<{ artist?: { album?: Album[] } }>(`/api/v1/media/navidrome/artist/${encodeURIComponent(artist.id)}`)
      setAlbums(data.artist?.album || [])
      setSongs([])
      setHeading(artist.name)
      setError('')
    } catch { setError('Alben konnten nicht geladen werden.') } finally { setLoading(false) }
  }

  const openAlbum = async (album: Album) => {
    setLoading(true)
    try {
      const data = await request<{ album?: Album & { song?: Song[] } }>(`/api/v1/media/navidrome/album/${encodeURIComponent(album.id)}`)
      setSongs(data.album?.song || [])
      setHeading(album.name)
      setError('')
    } catch { setError('Titel konnten nicht geladen werden.') } finally { setLoading(false) }
  }

  const play = async (song: Song) => {
    try {
      const response = await fetch('/api/v1/media/navidrome/play', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: song.id }),
      })
      if (!response.ok) throw new Error()
    } catch { setError('Titel konnte nicht gestartet werden.') }
  }

  if (!active || !configured) return null

  return (
    <div className="mt-4 border-t border-denon-border/50 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-denon-muted uppercase tracking-wider">{heading}</h3>
        {(albums.length > 0 || songs.length > 0) && (
          <button type="button" onClick={() => { setAlbums([]); setSongs([]) }} className="text-[10px] text-denon-gold">Library</button>
        )}
      </div>
      {loading && <p className="text-xs text-denon-muted">Loading...</p>}
      {!loading && error && <p className="text-xs text-denon-red">{error}</p>}
      {!loading && !error && songs.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {songs.map(song => (
            <button key={song.id} type="button" onClick={() => void play(song)} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs bg-denon-surface/70 hover:bg-denon-surface">
              {song.coverArt && <img src={`/api/v1/media/navidrome/cover/${encodeURIComponent(song.coverArt)}`} alt="" className="w-8 h-8 rounded object-cover" />}
              <span className="min-w-0 truncate"><span className="text-denon-text">{song.title}</span><span className="block text-[10px] text-denon-muted truncate">{song.artist || song.album || ''}</span></span>
            </button>
          ))}
        </div>
      )}
      {!loading && !error && songs.length === 0 && albums.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {albums.map(album => <button key={album.id} type="button" onClick={() => void openAlbum(album)} className="w-full text-left rounded-lg px-3 py-2 text-xs bg-denon-surface/70 hover:bg-denon-surface text-denon-text">{album.name}<span className="block text-[10px] text-denon-muted">{album.songCount || 0} Titel</span></button>)}
        </div>
      )}
      {!loading && !error && songs.length === 0 && albums.length === 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {artists.map(artist => <button key={artist.id} type="button" onClick={() => void openArtist(artist)} className="w-full text-left rounded-lg px-3 py-2 text-xs bg-denon-surface/70 hover:bg-denon-surface text-denon-text">{artist.name}<span className="block text-[10px] text-denon-muted">{artist.albumCount || 0} Alben</span></button>)}
        </div>
      )}
    </div>
  )
}
