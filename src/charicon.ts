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
