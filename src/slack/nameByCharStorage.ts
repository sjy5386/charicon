/** localStorage: workspace teamdomain → hangul char → emoji name (no colons). */

const STORAGE_KEY = 'charicon.emojiNameByChar.v1'

type StoredByWorkspace = Record<string, Record<string, string>>

function readAll(): StoredByWorkspace {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}
        const parsed: unknown = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return {}
        return parsed as StoredByWorkspace
    } catch {
        return {}
    }
}

function writeAll(all: StoredByWorkspace): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    } catch {
        /* quota / private mode */
    }
}

export function loadNameByCharForWorkspace(
    teamdomain: string | null | undefined,
): Record<string, string> {
    if (!teamdomain) return {}
    const map = readAll()[teamdomain]
    if (!map || typeof map !== 'object') return {}
    // shallow copy so React state isn't frozen to storage object
    return {...map}
}

export function saveNameByCharForWorkspace(
    teamdomain: string | null | undefined,
    nameByChar: Record<string, string>,
): void {
    if (!teamdomain) return
    const all = readAll()
    // Drop empty maps to keep storage small
    if (Object.keys(nameByChar).length === 0) {
        delete all[teamdomain]
    } else {
        all[teamdomain] = {...nameByChar}
    }
    writeAll(all)
}
