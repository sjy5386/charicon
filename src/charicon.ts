const hexByte = (n: number) => n.toString(16).padStart(2, '0')

/** Convert `rgb(r, g, b)` (or pass through #hex) for `<input type="color">`. */
export const toHexColor = (color: string): string => {
    if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
        if (color.length === 4) {
            const r = color[1]!
            const g = color[2]!
            const b = color[3]!
            return `#${r}${r}${g}${g}${b}${b}`
        }
        return color
    }
    const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (!m) return '#000000'
    return `#${hexByte(Number(m[1]!))}${hexByte(Number(m[2]!))}${hexByte(Number(m[3]!))}`
}

/** Dark-ish random color (0–127 per channel). Suitable for emoji backgrounds with white glyphs. */
export const randomColor = (): string => {
    const r = Math.floor(Math.random() * 128)
    const g = Math.floor(Math.random() * 128)
    const b = Math.floor(Math.random() * 128)
    return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`
}

/** Parse #rgb / #rrggbb (or rgb()) into 0–255 channels. */
export const parseRgb = (color: string): {r: number; g: number; b: number} | null => {
    if (color.startsWith('#')) {
        const hex = toHexColor(color)
        const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
        if (!m) return null
        return {r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16)}
    }
    const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (!m) return null
    return {r: Number(m[1]), g: Number(m[2]), b: Number(m[3])}
}

const rgbToHsl = (r: number, g: number, b: number): {h: number; s: number; l: number} => {
    const rn = r / 255
    const gn = g / 255
    const bn = b / 255
    const max = Math.max(rn, gn, bn)
    const min = Math.min(rn, gn, bn)
    const l = (max + min) / 2
    if (max === min) return {h: 0, s: 0, l}
    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    let h = 0
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / d + 2) / 6
    else h = ((rn - gn) / d + 4) / 6
    return {h, s, l}
}

const hslToRgb = (h: number, s: number, l: number): {r: number; g: number; b: number} => {
    if (s === 0) {
        const v = Math.round(l * 255)
        return {r: v, g: v, b: v}
    }
    const hue2rgb = (p: number, q: number, t: number) => {
        let tt = t
        if (tt < 0) tt += 1
        if (tt > 1) tt -= 1
        if (tt < 1 / 6) return p + (q - p) * 6 * tt
        if (tt < 1 / 2) return q
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
        return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    return {
        r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        g: Math.round(hue2rgb(p, q, h) * 255),
        b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    }
}

/**
 * Complementary color on the color wheel (HSL hue + 180°).
 * Keeps saturation/lightness so dark backgrounds stay dark (better than RGB invert).
 */
export const complementaryColor = (color: string): string => {
    const rgb = parseRgb(color)
    if (!rgb) return color
    const {h, s, l} = rgbToHsl(rgb.r, rgb.g, rgb.b)
    // Achromatic: no meaningful hue — nudge lightness slightly so gradient isn't flat
    if (s < 0.02) {
        const flipped = l > 0.5 ? Math.max(0, l - 0.35) : Math.min(1, l + 0.35)
        const {r, g, b} = hslToRgb(h, s, flipped)
        return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`
    }
    const {r, g, b} = hslToRgb((h + 0.5) % 1, s, l)
    return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`
}

/** Random dark start + its complementary end. */
export const randomComplementGradient = (): {start: string; end: string} => {
    const start = randomColor()
    return {start, end: complementaryColor(start)}
}

const charColorCache = new Map<string, string>()

export const colorForChar = (ch: string): string => {
    let color = charColorCache.get(ch)
    if (!color) {
        color = randomColor()
        charColorCache.set(ch, color)
    }
    return color
}

export const downloadCanvas = (canvas: HTMLCanvasElement | null, filename: string) => {
    if (canvas) {
        const dataURL = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = dataURL;
        downloadLink.download = filename;
        downloadLink.click();
    } else {
        console.error("Canvas element not found.");
    }
}

/** Update the browser tab favicon from a canvas (or data URL). */
export const setFaviconFromCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    setFaviconFromDataUrl(canvas.toDataURL('image/png'))
}

export const setFaviconFromDataUrl = (dataUrl: string) => {
    let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']")
    if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
    }
    link.type = 'image/png'
    // Cache-bust so browsers that ignore same-href updates still refresh
    link.href = dataUrl
}

const CHOSEONG = [
    'r', 'rr', 's', 'e', 'ee', 'f', 'a', 'q', 'qq', 't',
    'tt', 'd', 'w', 'ww', 'c', 'z', 'x', 'v', 'g',
] as const;

const JUNGSEONG = [
    'k', 'o', 'i', 'oo', 'j', 'p', 'u', 'pp', 'h', 'hk',
    'ho', 'hl', 'y', 'n', 'nj', 'np', 'nl', 'b', 'm', 'ml', 'l',
] as const;

const JONGSEONG = [
    '', 'r', 'rr', 'rt', 's', 'sw', 'sg', 'e', 'f', 'fr',
    'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'qt', 't',
    'tt', 'd', 'w', 'c', 'z', 'x', 'v', 'g',
] as const;

const HANGUL_BASE = 0xAC00;
const HANGUL_END = 0xD7A3;

/** Random Hangul syllable in the 가–힣 range (U+AC00–U+D7A3). */
export const randomHangul = (): string => {
    const code = HANGUL_BASE + Math.floor(Math.random() * (HANGUL_END - HANGUL_BASE + 1))
    return String.fromCharCode(code)
}

export const hangulToQwerty = (text: string): string => {
    let result = '';
    for (const ch of text) {
        const code = ch.charCodeAt(0);
        if (code >= HANGUL_BASE && code <= HANGUL_END) {
            const offset = code - HANGUL_BASE;
            const cho = Math.floor(offset / (21 * 28));
            const jung = Math.floor((offset % (21 * 28)) / 28);
            const jong = offset % 28;
            result += CHOSEONG[cho] + JUNGSEONG[jung] + JONGSEONG[jong];
        } else {
            result += ch;
        }
    }
    return result;
}

/**
 * Workspace custom-emoji name candidates for a base qwerty name.
 * Only:
 *   - exact base (cl)
 *   - base + digits (cl2, cl10)
 *   - base + last letter repeated n times (tm → tmm, tmmm)
 * Not plain prefix (cl must not match clap).
 */
export const findEmojiNameVariants = (
    base: string,
    emojiMap: Record<string, string>,
): string[] => {
    if (!base) return []
    const last = base[base.length - 1] ?? ''
    const matches: string[] = []
    for (const name of Object.keys(emojiMap)) {
        if (name === base) {
            matches.push(name)
            continue
        }
        if (!name.startsWith(base)) continue
        const rest = name.slice(base.length)
        if (!rest) continue
        // :cl2: :cl10:
        if (/^\d+$/.test(rest)) {
            matches.push(name)
            continue
        }
        // :tmm: :tmmm: — only the last char of base, repeated
        if (last && [...rest].every((c) => c === last)) {
            matches.push(name)
        }
    }
    matches.sort((a, b) => {
        if (a === base) return -1
        if (b === base) return 1
        if (a.length !== b.length) return a.length - b.length
        return a.localeCompare(b, 'en', {numeric: true})
    })
    return matches
}

/**
 * Resolve which custom-emoji name to use for a base qwerty name.
 *
 * - base registered → base
 * - base missing, alternates exist (cl2, tmm, …) → first alternate (or valid override)
 * - nothing registered → base (text still uses :base:; UI treats as missing)
 *
 * Override is applied only if it is still in the current candidate list.
 */
export const resolveEmojiName = (
    base: string,
    emojiMap: Record<string, string> | undefined,
    override?: string,
): string => {
    if (!emojiMap) return override ?? base
    const variants = findEmojiNameVariants(base, emojiMap)
    if (variants.length === 0) return base
    if (override && variants.includes(override)) return override
    if (variants.includes(base)) return base
    // base absent; prefer first alternate (e.g. only :cl2:)
    return variants[0]!
}

export type WorkspaceEmojiResolution = {
    base: string
    name: string
    variants: string[]
    /** Workspace has base and/or allowed alternates. */
    registered: boolean
    imageUrl: string | undefined
}

/** Hangul syllable → workspace registration + resolved name for preview/convert. */
export const resolveHangulWorkspaceEmoji = (
    hangulCh: string,
    emojiMap: Record<string, string> | undefined,
    override?: string,
): WorkspaceEmojiResolution => {
    const base = hangulToQwerty(hangulCh)
    if (!emojiMap) {
        return {base, name: base, variants: [], registered: false, imageUrl: undefined}
    }
    const variants = findEmojiNameVariants(base, emojiMap)
    if (variants.length === 0) {
        return {base, name: base, variants: [], registered: false, imageUrl: undefined}
    }
    const name = resolveEmojiName(base, emojiMap, override)
    return {
        base,
        name,
        variants,
        registered: true,
        imageUrl: emojiMap[name],
    }
}

/**
 * ASCII punctuation → Slack standard emoji.
 * Converter preview uses `glyph`; copy text uses `:name:`.
 */
export const PUNCTUATION_SLACK_EMOJI: Record<string, {name: string; glyph: string}> = {
    '?': {name: 'question', glyph: '❓'},
    '!': {name: 'exclamation', glyph: '❗'},
}

export const hangulToSlackEmoji = (
    text: string,
    /** Hangul character → custom emoji name (without colons). Applies to every occurrence. */
    nameByChar?: ReadonlyMap<string, string> | Record<string, string>,
    /** When set, missing base names can fall back to registered variants. */
    emojiMap?: Record<string, string>,
): string => {
    let result = ''
    for (const ch of text) {
        const code = ch.charCodeAt(0)
        if (code >= HANGUL_BASE && code <= HANGUL_END) {
            let override: string | undefined
            if (nameByChar instanceof Map) {
                override = nameByChar.get(ch)
            } else if (nameByChar && Object.prototype.hasOwnProperty.call(nameByChar, ch)) {
                override = (nameByChar as Record<string, string>)[ch]
            }
            const {name} = resolveHangulWorkspaceEmoji(ch, emojiMap, override)
            result += `:${name}:`
        } else {
            const punct = PUNCTUATION_SLACK_EMOJI[ch]
            result += punct ? `:${punct.name}:` : ch
        }
    }
    return result
}
