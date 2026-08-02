export const randomColor = () => `rgb(${Math.floor(Math.random() * 128)}, ${Math.floor(Math.random() * 128)}, ${Math.floor(Math.random() * 128)})`

const charColorCache = new Map<string, string>()

export const colorForChar = (ch: string): string => {
    let color = charColorCache.get(ch)
    if (!color) {
        color = randomColor()
        charColorCache.set(ch, color)
    }
    return color
}

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
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0')
    return `#${hex(m[1]!)}${hex(m[2]!)}${hex(m[3]!)}`
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
            result += ch
        }
    }
    return result
}
