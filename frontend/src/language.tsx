import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Language = 'de' | 'en'

type TranslationKey =
  | 'controls'
  | 'audio'
  | 'profiles'
  | 'heos'
  | 'setup'
  | 'language'
  | 'german'
  | 'english'
  | 'connecting'
  | 'searchingReceiver'
  | 'scanningNetwork'
  | 'setupTitle'
  | 'connectionsServices'
  | 'connected'
  | 'disconnected'
  | 'builtIn'
  | 'save'
  | 'cancel'

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    controls: 'Controls', audio: 'Audio', profiles: 'Profiles', heos: 'HEOS',
    setup: 'Setup', language: 'Language', german: 'Deutsch', english: 'English',
    connecting: 'Connecting...', searchingReceiver: 'Searching for receiver...',
    scanningNetwork: 'Scanning your network for Denon / Marantz AVRs',
    setupTitle: 'Setup', connectionsServices: 'Connections and optional services',
    connected: 'Connected', disconnected: 'Disconnected', builtIn: 'Built in',
    save: 'Save', cancel: 'Cancel',
  },
  de: {
    controls: 'Steuerung', audio: 'Audio', profiles: 'Profile', heos: 'HEOS',
    setup: 'Einstellungen', language: 'Sprache', german: 'Deutsch', english: 'English',
    connecting: 'Verbinde...', searchingReceiver: 'Receiver wird gesucht...',
    scanningNetwork: 'Netzwerk wird nach Denon / Marantz AVRs durchsucht',
    setupTitle: 'Einstellungen', connectionsServices: 'Verbindungen und optionale Dienste',
    connected: 'Verbunden', disconnected: 'Nicht verbunden', builtIn: 'Integriert',
    save: 'Speichern', cancel: 'Abbrechen',
  },
}

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey) => string
  tr: (text: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const germanText: Record<string, string> = {
  'Media': 'Medien',
  'Active input': 'Aktiver Eingang',
  'Audio/video signal from this input': 'Audio-/Videosignal dieses Eingangs',
  'Now Playing': 'Wiedergabe',
  'Source:': 'Quelle:',
  'Station:': 'Sender:',
  'Playing': 'Wiedergabe',
  'Paused': 'Pausiert',
  'HEOS Presets': 'HEOS-Presets',
  'Queue': 'Warteschlange',
  'Input Source': 'Eingangsquelle',
  'Inputs': 'Eingänge',
  'Favorites': 'Favoriten',
  'Cycle Modes': 'Modi wechseln',
  'Available Sound Modes': 'Verfügbare Sound-Modi',
  'Signal': 'Signal',
  'Stereo is the incoming audio codec or selected playback mode currently used by the receiver.': 'Stereo ist der aktuell vom Receiver verwendete Audio-Codec oder Wiedergabemodus.',
  'Audio Settings': 'Audio-Einstellungen',
  'Dialog Enhancer': 'Dialogverstärker',
  'Dialog Level': 'Dialogpegel',
  'Reference Level Offset': 'Referenzpegel-Versatz',
  'Speaker Levels': 'Lautsprecherpegel',
  'Turn on the receiver to see speaker levels.': 'Schalte den Receiver ein, um die Lautsprecherpegel zu sehen.',
  'Power': 'Ein/Aus',
  'Volume': 'Lautstärke',
  'Mute': 'Stummschaltung',
  'Tone': 'Klang',
  'Bass': 'Bass',
  'Treble': 'Höhen',
  'Subwoofer': 'Subwoofer',
  'Sound mode': 'Sound-Modus',
  'Use current mode': 'Aktuellen Modus verwenden',
  'Auto (automatic sound detection)': 'Auto (automatische Sound-Erkennung)',
  'Profile saved': 'Profil gespeichert',
  'New profile': 'Neues Profil',
  'Save profile': 'Profil speichern',
  'Apply to AVR': 'Auf AVR anwenden',
  'Changes are local until saved': 'Änderungen sind bis zum Speichern lokal',
}

function initialLanguage(): Language {
  try {
    return localStorage.getItem('denon-language') === 'de' ? 'de' : 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    try { localStorage.setItem('denon-language', next) } catch { /* storage unavailable */ }
  }, [])
  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key: TranslationKey) => translations[language][key],
    tr: (text: string) => language === 'de' ? germanText[text] || text : text,
  }), [language, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
