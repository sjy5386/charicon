import {hangulToQwerty} from './charicon.ts'

/** Complete hangul syllables 가 (U+AC00) … 힣 (U+D7A3). */
export const HANGUL_BASE = 0xac00
export const HANGUL_END = 0xd7a3
export const HANGUL_COUNT = HANGUL_END - HANGUL_BASE + 1 // 11_172

export type HangulCatalogEntry = {
    index: number
    char: string
    /** Two-set Korean → QWERTY emoji name (no colons). */
    base: string
}

/** 0 = missing, 1 = base name registered, 2 = only alternate (cl2, tmm, …) */
export const REG_MISSING = 0
export const REG_BASE = 1
export const REG_ALTERNATE = 2

export type RegKind = typeof REG_MISSING | typeof REG_BASE | typeof REG_ALTERNATE

export type HangulRegSnapshot = {
    /** Parallel to getHangulEntries() — length HANGUL_COUNT */
    kind: Uint8Array
    /** Resolved emoji name for preview (base preferred). Empty string if missing. */
    name: string[]
    baseCount: number
    alternateCount: number
    missingCount: number
}

let entriesCache: HangulCatalogEntry[] | null = null

export function getHangulEntries(): HangulCatalogEntry[] {
    if (entriesCache) return entriesCache
    const out: HangulCatalogEntry[] = new Array(HANGUL_COUNT)
    for (let i = 0; i < HANGUL_COUNT; i++) {
        const char = String.fromCharCode(HANGUL_BASE + i)
        out[i] = {index: i, char, base: hangulToQwerty(char)}
    }
    entriesCache = out
    return out
}

/**
 * Build registration status for every hangul syllable against a workspace emoji map.
 * Matches converter/generator rules: exact base, or base+digits / last-letter repeats.
 * O(emojiNames × nameLength) + O(hangul) — not O(hangul × emojiNames).
 */
export function buildHangulRegSnapshot(
    emojiMap: Record<string, string> | undefined,
): HangulRegSnapshot | null {
    if (!emojiMap) return null

    const entries = getHangulEntries()
    const kind = new Uint8Array(HANGUL_COUNT)
    const name: string[] = new Array(HANGUL_COUNT)
    for (let i = 0; i < HANGUL_COUNT; i++) name[i] = ''

    const baseToIndex = new Map<string, number>()
    for (const e of entries) {
        baseToIndex.set(e.base, e.index)
    }

    // Pass 1: exact base names
    for (const emojiName of Object.keys(emojiMap)) {
        const idx = baseToIndex.get(emojiName)
        if (idx === undefined) continue
        kind[idx] = REG_BASE
        name[idx] = emojiName
    }

    // Pass 2: alternates for still-missing bases (prefix = hangul base)
    for (const emojiName of Object.keys(emojiMap)) {
        if (baseToIndex.has(emojiName)) continue // already base of some hangul

        for (let len = emojiName.length - 1; len >= 1; len--) {
            const base = emojiName.slice(0, len)
            const idx = baseToIndex.get(base)
            if (idx === undefined) continue
            if (kind[idx] === REG_BASE) continue

            const rest = emojiName.slice(len)
            if (!rest) continue

            let ok = false
            if (/^\d+$/.test(rest)) {
                ok = true
            } else {
                const last = base[base.length - 1] ?? ''
                ok = !!last && [...rest].every((c) => c === last)
            }
            if (!ok) continue

            // Prefer shorter / lexicographically smaller alternate (same spirit as findEmojiNameVariants)
            if (kind[idx] === REG_MISSING) {
                kind[idx] = REG_ALTERNATE
                name[idx] = emojiName
            } else if (kind[idx] === REG_ALTERNATE) {
                const prev = name[idx]!
                if (
                    emojiName.length < prev.length ||
                    (emojiName.length === prev.length && emojiName < prev)
                ) {
                    name[idx] = emojiName
                }
            }
        }
    }

    let baseCount = 0
    let alternateCount = 0
    for (let i = 0; i < HANGUL_COUNT; i++) {
        if (kind[i] === REG_BASE) baseCount++
        else if (kind[i] === REG_ALTERNATE) alternateCount++
    }

    return {
        kind,
        name,
        baseCount,
        alternateCount,
        missingCount: HANGUL_COUNT - baseCount - alternateCount,
    }
}

export type CatalogFilter = 'all' | 'registered' | 'missing' | 'alternate'

export function filterHangulIndices(
    snapshot: HangulRegSnapshot | null,
    filter: CatalogFilter,
    query: string,
): number[] {
    const entries = getHangulEntries()
    const q = query.trim().toLowerCase()
    const out: number[] = []

    for (let i = 0; i < HANGUL_COUNT; i++) {
        const k = snapshot ? snapshot.kind[i]! : REG_MISSING

        if (filter === 'registered' && k === REG_MISSING) continue
        if (filter === 'missing' && k !== REG_MISSING) continue
        if (filter === 'alternate' && k !== REG_ALTERNATE) continue

        if (q) {
            const e = entries[i]!
            const nm = snapshot?.name[i] ?? ''
            const hit =
                e.char === q ||
                e.char.includes(q) ||
                e.base.includes(q) ||
                (nm !== '' && nm.includes(q))
            if (!hit) continue
        }

        out.push(i)
    }
    return out
}
