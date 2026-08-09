/**
 * Local hangul preview tiles — shared by converter + catalog.
 * Matches .slack-preview.is-jumbo / .is-inline emoji sizes and generator glyph stack.
 */
import {colorForChar} from './charicon.ts'
import {fillTextWithFontFallback} from './fontFallback.ts'

// Keep in sync with .slack-preview-emoji / .slack-preview.is-jumbo .slack-preview-emoji
export const EMOJI_STYLE = {
    jumbo: {box: 32, font: 28, radius: 4},
    inline: {box: 20, font: 17, radius: 3},
} as const

export type EmojiPreviewMode = keyof typeof EMOJI_STYLE

/** Draw converter-style preview onto a canvas (favicon + local tiles). */
export const drawPreviewEmojiToCanvas = (
    ch: string,
    mode: EmojiPreviewMode = 'jumbo',
    size = 64,
): HTMLCanvasElement => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    const {box, font, radius: r} = EMOJI_STYLE[mode]
    const radius = size * (r / box)
    ctx.fillStyle = colorForChar(ch)
    ctx.beginPath()
    ctx.roundRect(0, 0, size, size, radius)
    ctx.fill()

    const fontSize = size * (font / box)
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Slight optical center for hangul; ChosunGs → Gungsuhche + optical scale
    fillTextWithFontFallback(
        ctx,
        ch,
        size / 2,
        size / 2 + size * 0.02,
        fontSize,
    )
    return canvas
}

/** mode\0char → data URL (same glyph stack as generator canvas). */
const localPreviewCache = new Map<string, string>()

export const localPreviewDataUrl = (
    ch: string,
    mode: EmojiPreviewMode,
): string => {
    const key = `${mode}\0${ch}`
    let url = localPreviewCache.get(key)
    if (!url) {
        // Render at 2× for crisp downscale in the 20–32px preview tiles
        url = drawPreviewEmojiToCanvas(ch, mode, 64).toDataURL('image/png')
        localPreviewCache.set(key, url)
    }
    return url
}
