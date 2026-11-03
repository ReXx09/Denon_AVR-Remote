import type { SourceAudioProfile } from './types'

const SOURCE_PROFILE_ALIASES: Record<string, string> = {
  GARGAME1: 'GAME1',
  IRADIO: 'NET',
}

export function findSourceProfile(
  profiles: Record<string, SourceAudioProfile> | null | undefined,
  sourceCode: string | null | undefined,
): SourceAudioProfile | undefined {
  if (!profiles || typeof sourceCode !== 'string') return undefined

  const normalize = (code: string) => {
    const normalized = code.trim().toUpperCase()
    return SOURCE_PROFILE_ALIASES[normalized] || normalized
  }
  const exactCode = sourceCode.trim().toUpperCase()
  const exactProfile = Object.entries(profiles).find(([code]) => code.trim().toUpperCase() === exactCode)?.[1]
  if (exactProfile) return exactProfile

  const canonicalCode = normalize(sourceCode)
  return Object.entries(profiles).find(([code]) => normalize(code) === canonicalCode)?.[1]
}
