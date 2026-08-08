/**
 * Glyph-aware font fallback for bundled webfonts only.
 * OS system fonts are intentionally excluded — metrics and look differ by platform.
 *
 * When the resolved face differs from the primary, scale its font-size so the
 * optical ink height of a shared reference hangul matches the primary face.
 */

/** Bundled webfonts (see fonts.css). Order is the fixed stack: primary → fallback. */
export const WEB_FONTS = ['ChosunGs', 'Gungsuhche'] as const

/** Always use ChosunGs first; Gungsuhche only when a glyph is missing. */
export const PRIMARY_FONT = WEB_FONTS[0]

/** Reference hangul both faces should contain (for optical size matching). */
const OPTICAL_REF_CHAR = '한'

const glyphCache = new Map<string, boolean>()
/** primary\0face → scale to apply to `face` so it matches `primary` ink height */
const opticalScaleCache = new Map<string, number>()

let probe: {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
} | null = null

const PROBE_SIZE = 48
/** Larger canvas for ink-height measurement (subpixel stability). */
const INK_SIZE = 96

const getProbe = (size = PROBE_SIZE) => {
    if (probe && probe.canvas.width >= size) return probe
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', {willReadFrequently: true})
    if (!ctx) throw new Error('2d context unavailable')
    probe = {canvas, ctx}
    return probe
}

/** Painted ink height in CSS px for `char` at `fontSize`, or 0 if empty. */
const measureInkHeight = (fontFamily: string, fontSize: number, char: string): number => {
    if (!char) return 0
    if (!document.fonts.check(`${fontSize}px "${fontFamily}"`)) return 0

    const size = Math.max(INK_SIZE, Math.ceil(fontSize * 1.5))
    const {canvas, ctx} = getProbe(size)
    if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size
        canvas.height = size
    }
    ctx.clearRect(0, 0, size, size)
    ctx.font = `${fontSize}px "${fontFamily}"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#000'
    ctx.fillText(char, size / 2, size / 2)

    const data = ctx.getImageData(0, 0, size, size).data
    let minY = size
    let maxY = -1
    for (let y = 0; y < size; y++) {
        const row = y * size * 4
        for (let x = 0; x < size; x++) {
            if (data[row + x * 4 + 3]! !== 0) {
                if (y < minY) minY = y
                if (y > maxY) maxY = y
            }
        }
    }
    if (maxY < minY) return 0
    return maxY - minY + 1
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

    const has = measureInkHeight(fontFamily, PROBE_SIZE, char) > 0
    glyphCache.set(key, has)
    return has
}

/** Fixed stack: ChosunGs → Gungsuhche. No system fallbacks. */
export const fontStack = (): readonly string[] => WEB_FONTS

/**
 * First font in the stack that can draw `char`.
 * If none can, returns the primary (may still render blank).
 */
export const resolveFontForChar = (char: string): string => {
    for (const f of WEB_FONTS) {
        if (fontHasGlyph(f, char)) return f
    }
    return PRIMARY_FONT
}

/**
 * Scale factor for `face` so its optical size matches `primary`
 * (using a shared reference hangul both faces can draw).
 */
export const opticalScaleForFace = (face: string, primary: string): number => {
    if (face === primary) return 1

    const key = `${primary}\0${face}`
    const cached = opticalScaleCache.get(key)
    if (cached !== undefined) return cached

    const primaryH = measureInkHeight(primary, INK_SIZE, OPTICAL_REF_CHAR)
    const faceH = measureInkHeight(face, INK_SIZE, OPTICAL_REF_CHAR)
    let scale = 1
    if (primaryH > 0 && faceH > 0) {
        scale = primaryH / faceH
        // Guard against wild outliers from bad probes
        scale = Math.min(1.35, Math.max(0.75, scale))
    }
    opticalScaleCache.set(key, scale)
    return scale
}

export type ResolvedFace = {
    family: string
    /** Multiply requested font-size by this so fallback matches primary optically. */
    scale: number
}

export const resolveFaceForChar = (char: string): ResolvedFace => {
    const family = resolveFontForChar(char)
    const scale = opticalScaleForFace(family, PRIMARY_FONT)
    return {family, scale}
}

/** CSS `font-family` for a single character (quoted family name only). */
export const cssFontFamilyForChar = (char: string): string =>
    `"${resolveFontForChar(char)}"`

/**
 * Inline style for DOM text: family + optional optical size correction.
 * Pass `baseFontSizePx` (the CSS pixel size of the element) so scale does not
 * clobber a same-element `font-size` with a wrong `em` base.
 */
export const cssFontStyleForChar = (
    char: string,
    baseFontSizePx?: number,
): {fontFamily: string; fontSize?: string} => {
    const {family, scale} = resolveFaceForChar(char)
    if (Math.abs(scale - 1) < 0.01) {
        return {fontFamily: `"${family}"`}
    }
    if (baseFontSizePx != null && baseFontSizePx > 0) {
        const px = Math.round(baseFontSizePx * scale * 100) / 100
        return {fontFamily: `"${family}"`, fontSize: `${px}px`}
    }
    // No base size: leave font-size to CSS (family only)
    return {fontFamily: `"${family}"`}
}

export const ensureWebFontsLoaded = async (size = 72): Promise<void> => {
    await Promise.all(
        WEB_FONTS.map((f) =>
            document.fonts.load(`${size}px "${f}"`).catch(() => undefined),
        ),
    )
}

/**
 * Draw `text` with per-grapheme font selection and optical size matching.
 * Honors current fillStyle / textBaseline; textAlign is applied on the whole run
 * (left/start from x, center around x, right/end ending at x).
 */
export const fillTextWithFontFallback = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
): void => {
    if (!text) return

    const chars = Array.from(text)
    const faces = chars.map((ch) => resolveFaceForChar(ch))
    const sizes = faces.map((f) => fontSize * f.scale)
    const widths = chars.map((ch, i) => {
        ctx.font = `${sizes[i]}px "${faces[i]!.family}"`
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
        ctx.font = `${sizes[i]}px "${faces[i]!.family}"`
        ctx.fillText(chars[i]!, cursor, y)
        cursor += widths[i]!
    }
    ctx.textAlign = prevAlign
}
