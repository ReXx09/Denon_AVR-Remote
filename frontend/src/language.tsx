import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

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
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function initialLanguage(): Language {
  try {
    return localStorage.getItem('denon-language') === 'de' ? 'de' : 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  const value = useMemo(() => ({
    language,
    setLanguage: (next: Language) => {
      setLanguageState(next)
      try { localStorage.setItem('denon-language', next) } catch { /* storage unavailable */ }
    },
    t: (key: TranslationKey) => translations[language][key],
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
