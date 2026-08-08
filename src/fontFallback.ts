/**
 * Glyph-aware font fallback for bundled webfonts only.
 * OS system fonts are intentionally excluded — metrics and look differ by platform.
 */

/** Bundled webfonts (see fonts.css). Order is the default stack. */
export const WEB_FONTS = ['ChosunGs', 'Gungsuhche'] as const

const glyphCache = new Map<string, boolean>()

let probe: {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
} | null = null

const PROBE_SIZE = 48

const getProbe = () => {
    if (probe) return probe
    const canvas = document.createElement('canvas')
    canvas.width = PROBE_SIZE
    canvas.height = PROBE_SIZE
    const ctx = canvas.getContext('2d', {willReadFrequently: true})
    if (!ctx) throw new Error('2d context unavailable')
    probe = {canvas, ctx}
    return probe
}

/** True if `fontFamily` paints any pixels for `char` (missing glyphs are often empty). */
export const fontHasGlyph = (fontFamily: string, char: string): boolean => {
    if (!char) return false
    // Avoid probing (and caching) before the face is available — browser may substitute.
    if (!document.fonts.check(`${PROBE_SIZE}px "${fontFamily}"`)) {
        return false
    }

    const key = `${fontFamily}\0${char}`
    const cached = glyphCache.get(key)
    if (cached !== undefined) return cached

    const {ctx} = getProbe()
    const size = PROBE_SIZE
    ctx.clearRect(0, 0, size, size)
    ctx.font = `${size}px "${fontFamily}"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#000'
    ctx.fillText(char, size / 2, size / 2)

    const data = ctx.getImageData(0, 0, size, size).data
    let has = false
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) {
            has = true
            break
        }
    }
    glyphCache.set(key, has)
    return has
}

/** Primary first, then other bundled webfonts. No system fallbacks. */
export const fontStack = (primary?: string): string[] => {
    const stack: string[] = []
    if (primary) stack.push(primary)
    for (const f of WEB_FONTS) {
        if (!stack.includes(f)) stack.push(f)
    }
    return stack
}

/**
 * First font in the stack that can draw `char`.
 * If none can, returns the first stack entry (may still render blank).
 */
export const resolveFontForChar = (char: string, primary?: string): string => {
    const stack = fontStack(primary)
    for (const f of stack) {
        if (fontHasGlyph(f, char)) return f
    }
    return stack[0] ?? WEB_FONTS[0]
}

/** CSS `font-family` for a single character (quoted family name only). */
export const cssFontFamilyForChar = (char: string, primary?: string): string =>
    `"${resolveFontForChar(char, primary)}"`

export const ensureWebFontsLoaded = async (size = 72): Promise<void> => {
    await Promise.all(
        WEB_FONTS.map((f) =>
            document.fonts.load(`${size}px "${f}"`).catch(() => undefined),
        ),
    )
}

/**
 * Draw `text` with per-grapheme font selection.
 * Honors current fillStyle / textBaseline; textAlign is applied on the whole run
 * (left/start from x, center around x, right/end ending at x).
 */
export const fillTextWithFontFallback = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    primary?: string,
): void => {
    if (!text) return

    const chars = Array.from(text)
    const fonts = chars.map((ch) => resolveFontForChar(ch, primary))
    const widths = chars.map((ch, i) => {
        ctx.font = `${fontSize}px "${fonts[i]}"`
        return ctx.measureText(ch).width
    })
    const total = widths.reduce((a, b) => a + b, 0)

    const align = ctx.textAlign
    let cursor =
        align === 'center' ? x - total / 2
            : align === 'right' || align === 'end' ? x - total
                : x

    const prevAlign = ctx.textAlign
    ctx.textAlign = 'left'
    for (let i = 0; i < chars.length; i++) {
        ctx.font = `${fontSize}px "${fonts[i]}"`
        ctx.fillText(chars[i]!, cursor, y)
        cursor += widths[i]!
    }
    ctx.textAlign = prevAlign
}
