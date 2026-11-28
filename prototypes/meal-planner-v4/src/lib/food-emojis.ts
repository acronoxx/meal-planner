import emojiByFoodId from './food-emojis.json'

const EMOJIS = emojiByFoodId as Record<string, string>

/** Emoji associé à un aliment (clé = identifiant source / code-barres, sans zéros de tête). */
export function emojiForFood(fdcId: string): string | undefined {
  return EMOJIS[fdcId.trim().replace(/^0+/, '')]
}

/** Chemin du SVG OpenMoji (public/openmoji/<hexcode>.svg) pour un emoji. */
export function openmojiSrc(emoji: string): string {
  const hex = Array.from(emoji)
    .map((char) => char.codePointAt(0)!.toString(16).toUpperCase())
    .filter((code) => code !== 'FE0F')
    .join('-')
  return `/openmoji/${hex}.svg`
}
