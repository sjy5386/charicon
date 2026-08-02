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

export const hangulToSlackEmoji = (text: string): string => {
    let result = '';
    for (const ch of text) {
        const code = ch.charCodeAt(0);
        if (code >= HANGUL_BASE && code <= HANGUL_END) {
            result += `:${hangulToQwerty(ch)}:`;
        } else {
            result += ch;
        }
    }
    return result;
}
