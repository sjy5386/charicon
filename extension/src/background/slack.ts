import type {
    ListEmojiResult,
    ListTeamsResult,
    RegisterEmojiPayload,
    RegisterEmojiResult,
    Team,
} from '@shared/protocol'
import {getExtApi} from '../browser'

/**
 * Slack session helpers (no backend; uses browser cookies).
 *
 * Chrome MV3 service workers often do not attach Slack session cookies to
 * fetch(..., { credentials: 'include' }) the same way Firefox background
 * pages do. So we try fetch first, then fall back to page-context scrape
 * via tabs + scripting (real document cookies).
 */

type SlackLoggedInTeam = {
    team_name?: string
    team_domain?: string
    name?: string
    domain?: string
    is_enterprise?: boolean | number | string
    [key: string]: unknown
}

const SIGNIN_URLS = [
    'https://slack.com/signin',
    'https://slack.com/workspace-signin',
    'https://app.slack.com/workspace-signin',
]

const SKIP_SUBDOMAINS = new Set([
    'app',
    'api',
    'status',
    'slackb',
    'a',
    'b',
    'files',
    'hooks',
    'assets',
])

function decodeBasicEntities(html: string): string {
    return html
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#x22;/gi, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
}

/** Extract a JSON array value that follows `"key":` (handles nested brackets/strings). */
function extractJsonArrayAfterKey(source: string, key: string): unknown[] | null {
    const needle = `"${key}"`
    const keyIdx = source.indexOf(needle)
    if (keyIdx < 0) return null

    let i = source.indexOf(':', keyIdx + needle.length)
    if (i < 0) return null
    i += 1
    while (i < source.length && /\s/.test(source[i]!)) i++
    if (source[i] !== '[') return null

    const start = i
    let depth = 0
    let inString = false
    let escape = false

    for (; i < source.length; i++) {
        const c = source[i]!
        if (inString) {
            if (escape) {
                escape = false
                continue
            }
            if (c === '\\') {
                escape = true
                continue
            }
            if (c === '"') inString = false
            continue
        }
        if (c === '"') {
            inString = true
            continue
        }
        if (c === '[') depth++
        else if (c === ']') {
            depth--
            if (depth === 0) {
                try {
                    const parsed: unknown = JSON.parse(source.slice(start, i + 1))
                    return Array.isArray(parsed) ? parsed : null
                } catch {
                    return null
                }
            }
        }
    }
    return null
}

function normalizeTeam(raw: SlackLoggedInTeam): Team | null {
    if (raw.is_enterprise === true || raw.is_enterprise === 1 || raw.is_enterprise === 'true') {
        return null
    }
    const name = (raw.team_name || raw.name || '').trim()
    const teamdomain = (raw.team_domain || raw.domain || '').trim().toLowerCase()
    if (!name || !teamdomain) return null
    if (!/^[a-z0-9][a-z0-9-]*$/.test(teamdomain)) return null
    if (SKIP_SUBDOMAINS.has(teamdomain)) return null
    return {name, teamdomain}
}

function teamsFromLoggedInArray(arr: unknown[] | null): Team[] {
    if (!arr) return []
    const out: Team[] = []
    const seen = new Set<string>()
    for (const item of arr) {
        if (!item || typeof item !== 'object') continue
        const team = normalizeTeam(item as SlackLoggedInTeam)
        if (!team || seen.has(team.teamdomain)) continue
        seen.add(team.teamdomain)
        out.push(team)
    }
    return out
}

function teamsFromSlackLinks(html: string): Team[] {
    const re = /https?:\/\/([a-z0-9][a-z0-9-]*)\.slack\.com\b/gi
    const seen = new Set<string>()
    const out: Team[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
        const teamdomain = m[1]!.toLowerCase()
        if (SKIP_SUBDOMAINS.has(teamdomain) || seen.has(teamdomain)) continue
        seen.add(teamdomain)
        out.push({name: teamdomain, teamdomain})
    }
    return out
}

export function parseTeamsFromHtml(html: string): Team[] {
    const decoded = decodeBasicEntities(html)
    for (const source of [html, decoded]) {
        const fromKey = teamsFromLoggedInArray(extractJsonArrayAfterKey(source, 'loggedInTeams'))
        if (fromKey.length > 0) return fromKey

        const propsMatch =
            source.match(/id=["']props_node["'][^>]*data-props=["']([^"']*)["']/i) ||
            source.match(/data-props=["']([^"']*)["'][^>]*id=["']props_node["']/i)
        if (propsMatch?.[1]) {
            try {
                const props = JSON.parse(decodeBasicEntities(propsMatch[1])) as {
                    loggedInTeams?: unknown[]
                }
                const fromProps = teamsFromLoggedInArray(props.loggedInTeams ?? null)
                if (fromProps.length > 0) return fromProps
            } catch {
                /* continue */
            }
        }
    }
    return teamsFromSlackLinks(decoded)
}

function mergeTeams(...lists: Team[][]): Team[] {
    const seen = new Set<string>()
    const out: Team[] = []
    for (const list of lists) {
        for (const t of list) {
            if (seen.has(t.teamdomain)) continue
            seen.add(t.teamdomain)
            out.push(t)
        }
    }
    return out
}

async function fetchText(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            credentials: 'include',
            redirect: 'follow',
            cache: 'no-store',
            headers: {
                Accept: 'text/html,application/xhtml+xml',
            },
        })
        if (!res.ok) return null
        return await res.text()
    } catch {
        return null
    }
}

async function listTeamsViaFetch(): Promise<{teams: Team[]; sawHtml: boolean}> {
    let sawHtml = false
    const found: Team[] = []
    for (const url of SIGNIN_URLS) {
        const html = await fetchText(url)
        if (!html) continue
        sawHtml = true
        const teams = parseTeamsFromHtml(html)
        if (teams.length > 0) {
            return {teams: mergeTeams(found, teams), sawHtml}
        }
    }
    return {teams: found, sawHtml}
}

function teamdomainFromUrl(url: string | undefined): string | null {
    if (!url) return null
    try {
        const u = new URL(url)
        if (u.hostname === 'slack.com' || u.hostname === 'www.slack.com') return null
        const m = u.hostname.match(/^([a-z0-9][a-z0-9-]*)\.slack\.com$/i)
        if (!m) return null
        const d = m[1]!.toLowerCase()
        if (SKIP_SUBDOMAINS.has(d)) return null
        return d
    } catch {
        return null
    }
}

function waitForTabComplete(tabId: number, timeoutMs = 20000): Promise<void> {
    const api = getExtApi()
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            api.tabs.onUpdated.removeListener(onUpdated)
            reject(new Error('tab_timeout'))
        }, timeoutMs)

        function done() {
            clearTimeout(timer)
            api.tabs.onUpdated.removeListener(onUpdated)
            resolve()
        }

        function onUpdated(id: number, info: chrome.tabs.TabChangeInfo) {
            if (id === tabId && info.status === 'complete') done()
        }

        api.tabs.onUpdated.addListener(onUpdated)
        void api.tabs.get(tabId).then((tab) => {
            if (tab.status === 'complete') done()
        }).catch(() => {
            /* keep waiting */
        })
    })
}

async function executePageHtml(tabId: number): Promise<string | null> {
    const api = getExtApi()
    if (!api.scripting?.executeScript) return null
    try {
        const results = await api.scripting.executeScript({
            target: {tabId},
            func: () => document.documentElement.outerHTML,
        })
        const html = results?.[0]?.result
        return typeof html === 'string' ? html : null
    } catch {
        return null
    }
}

/** Teams inferred only from open tab URLs (no HTML parse). */
async function teamsFromOpenTabUrls(): Promise<Team[]> {
    const api = getExtApi()
    if (!api.tabs?.query) return []
    try {
        const tabs = await api.tabs.query({})
        const out: Team[] = []
        const seen = new Set<string>()
        for (const tab of tabs) {
            const d = teamdomainFromUrl(tab.url)
            if (!d || seen.has(d)) continue
            seen.add(d)
            out.push({name: d, teamdomain: d})
        }
        return out
    } catch {
        return []
    }
}

/** Scrape HTML from already-open Slack tabs (page cookies always apply). */
async function listTeamsFromOpenSlackTabs(): Promise<Team[]> {
    const api = getExtApi()
    if (!api.tabs?.query || !api.scripting?.executeScript) return []

    let tabs: chrome.tabs.Tab[] = []
    try {
        tabs = await api.tabs.query({})
    } catch {
        return []
    }

    const slackTabs = tabs.filter((t) => {
        const u = t.url ?? ''
        return (
            u.includes('slack.com') &&
            (u.startsWith('https://') || u.startsWith('http://'))
        )
    })

    const collected: Team[] = []
    for (const tab of slackTabs) {
        if (tab.id == null) continue
        const html = await executePageHtml(tab.id)
        if (html) {
            collected.push(...parseTeamsFromHtml(html))
        }
        const d = teamdomainFromUrl(tab.url)
        if (d) collected.push({name: d, teamdomain: d})
        if (collected.length > 0) {
            // enough signal from open tabs
            break
        }
    }
    return mergeTeams(collected)
}

/**
 * Open a background sign-in tab, wait for load, scrape, then close.
 * This is the Chrome-reliable path when SW fetch has no session cookies.
 */
async function listTeamsViaTempTab(): Promise<Team[]> {
    const api = getExtApi()
    if (!api.tabs?.create || !api.scripting?.executeScript) return []

    const collected: Team[] = []
    for (const url of SIGNIN_URLS) {
        let tabId: number | undefined
        try {
            const tab = await api.tabs.create({url, active: false})
            tabId = tab.id
            if (tabId == null) continue
            await waitForTabComplete(tabId)
            // SPA may hydrate after "complete"
            await new Promise((r) => setTimeout(r, 800))
            const html = await executePageHtml(tabId)
            if (html) {
                const teams = parseTeamsFromHtml(html)
                if (teams.length > 0) {
                    collected.push(...teams)
                    break
                }
            }
            const d = teamdomainFromUrl((await api.tabs.get(tabId)).url)
            if (d) collected.push({name: d, teamdomain: d})
        } catch {
            /* try next url */
        } finally {
            if (tabId != null) {
                try {
                    await api.tabs.remove(tabId)
                } catch {
                    /* ignore */
                }
            }
        }
        if (collected.length > 0) break
    }
    return mergeTeams(collected)
}

export async function listTeams(): Promise<ListTeamsResult> {
    // 1) fetch (works well on Firefox background pages)
    const viaFetch = await listTeamsViaFetch()
    if (viaFetch.teams.length > 0) {
        return {ok: true, teams: viaFetch.teams}
    }

    // 2) already-open Slack tabs (URL + HTML)
    const fromOpen = mergeTeams(
        await teamsFromOpenTabUrls(),
        await listTeamsFromOpenSlackTabs(),
    )
    if (fromOpen.length > 0) {
        return {ok: true, teams: fromOpen}
    }

    // 3) temporary tab scrape (Chrome cookie-friendly)
    const fromTemp = await listTeamsViaTempTab()
    if (fromTemp.length > 0) {
        return {ok: true, teams: fromTemp}
    }

    if (!viaFetch.sawHtml && fromOpen.length === 0 && fromTemp.length === 0) {
        // fetch failed entirely and tab APIs may be missing
        return {ok: false, error: 'network'}
    }
    return {ok: false, error: 'not_logged_in'}
}

// --- emoji.list (Step 3) ---

type EmojiCacheEntry = {at: number; emoji: Record<string, string>}
const emojiCache = new Map<string, EmojiCacheEntry>()
const EMOJI_CACHE_TTL_MS = 5 * 60 * 1000

type PageEmojiListResult =
    | {ok: true; emoji: Record<string, string>}
    | {ok: false; error: string}

function extractApiToken(html: string): string | null {
    const decoded = decodeBasicEntities(html)
    const patterns = [
        /["']?api_token["']?\s*:\s*["']([^"']{8,})["']/,
        /\bapi_token["']?\s*=\s*["']([^"']{8,})["']/,
        /name=["']token["'][^>]*value=["']([^"']{8,})["']/,
        /value=["']([^"']{8,})["'][^>]*name=["']token["']/,
        /"token"\s*:\s*"(xox[a-z]-[^"]+)"/,
    ]
    for (const source of [html, decoded]) {
        for (const re of patterns) {
            const m = source.match(re)
            if (m?.[1] && m[1].length >= 8) return m[1]
        }
    }
    return null
}

function resolveEmojiMap(raw: Record<string, string>): Record<string, string> {
    const resolve = (name: string, depth: number): string | null => {
        if (depth > 8) return null
        const value = raw[name]
        if (!value) return null
        if (value.startsWith('alias:')) {
            return resolve(value.slice('alias:'.length), depth + 1)
        }
        if (value.startsWith('http://') || value.startsWith('https://')) {
            return value
        }
        return null
    }

    const out: Record<string, string> = {}
    for (const name of Object.keys(raw)) {
        const url = resolve(name, 0)
        if (url) out[name] = url
    }
    return out
}

async function callEmojiListApi(
    teamdomain: string,
    token: string,
): Promise<Record<string, string> | null> {
    const endpoints = [
        `https://${teamdomain}.slack.com/api/emoji.list`,
        'https://slack.com/api/emoji.list',
    ]

    for (const url of endpoints) {
        try {
            const body = new URLSearchParams({token})
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                },
                body: body.toString(),
            })
            if (!res.ok) continue
            const json = (await res.json()) as {
                ok?: boolean
                emoji?: Record<string, string>
                error?: string
            }
            if (json.ok && json.emoji && typeof json.emoji === 'object') {
                return resolveEmojiMap(json.emoji)
            }
        } catch {
            /* try next */
        }
    }
    return null
}

/**
 * Runs inside the Slack page (MAIN world) so we can read boot_data and use
 * first-party cookies. Must be fully self-contained (no closed-over vars).
 *
 * Chrome's default executeScript world is ISOLATED — page JS globals are invisible.
 */
async function pageFetchEmojiList(): Promise<PageEmojiListResult> {
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

    const getToken = (): string | null => {
        const w = window as unknown as {
            boot_data?: {api_token?: string}
            TS?: {
                boot_data?: {api_token?: string}
                model?: {api_token?: string}
                tokens?: {api?: string}
            }
        }
        const candidates = [
            w.boot_data?.api_token,
            w.TS?.boot_data?.api_token,
            w.TS?.model?.api_token,
            w.TS?.tokens?.api,
        ]
        for (const c of candidates) {
            if (typeof c === 'string' && c.length >= 8) return c
        }

        const html = document.documentElement.innerHTML
        const patterns = [
            /api_token["']?\s*:\s*["']([^"']{8,})["']/,
            /"token"\s*:\s*"(xox[a-z]-[^"]+)"/,
            /name=["']token["'][^>]*value=["']([^"']{8,})["']/,
        ]
        for (const re of patterns) {
            const m = html.match(re)
            if (m?.[1]) return m[1]
        }
        return null
    }

    let token: string | null = null
    for (let i = 0; i < 40; i++) {
        token = getToken()
        if (token) break
        await sleep(250)
    }
    if (!token) {
        return {ok: false, error: 'token_not_found'}
    }

    // Prefer same-origin; also try team host if on app.slack.com
    const teamHost = location.hostname.match(/^([a-z0-9-]+)\.slack\.com$/i)?.[1]
    const urls = [
        `${location.origin}/api/emoji.list`,
        teamHost && teamHost !== 'app'
            ? `https://${teamHost}.slack.com/api/emoji.list`
            : null,
        'https://slack.com/api/emoji.list',
    ].filter(Boolean) as string[]

    for (const url of urls) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                },
                body: new URLSearchParams({token}).toString(),
            })
            if (!res.ok) continue
            const json = (await res.json()) as {
                ok?: boolean
                emoji?: Record<string, string>
                error?: string
            }
            if (json.ok && json.emoji && typeof json.emoji === 'object') {
                return {ok: true, emoji: json.emoji}
            }
            if (json.error) {
                return {ok: false, error: String(json.error)}
            }
        } catch {
            /* try next */
        }
    }
    return {ok: false, error: 'network'}
}

async function executePageEmojiList(tabId: number): Promise<PageEmojiListResult | null> {
    const api = getExtApi()
    if (!api.scripting?.executeScript) return null

    const run = async (world?: 'MAIN' | 'ISOLATED') => {
        // Async injected funcs are supported at runtime; @types/chrome types them as sync.
        const results = await api.scripting.executeScript({
            target: {tabId},
            func: pageFetchEmojiList as unknown as () => PageEmojiListResult,
            // Chrome: MAIN is required to read page boot_data
            ...(world ? {world} : {}),
        })
        return (results?.[0]?.result as PageEmojiListResult | undefined) ?? null
    }

    try {
        const main = await run('MAIN')
        if (main) return main
    } catch {
        /* MAIN unsupported or blocked — try isolated (HTML scrape path only) */
    }
    try {
        return await run('ISOLATED')
    } catch {
        return null
    }
}

async function listEmojiViaOpenTabs(teamdomain: string): Promise<PageEmojiListResult | null> {
    const api = getExtApi()
    if (!api.tabs?.query) return null

    let tabs: chrome.tabs.Tab[] = []
    try {
        tabs = await api.tabs.query({})
    } catch {
        return null
    }

    const needle = `${teamdomain}.slack.com`
    // Prefer customize/emoji and client tabs for this workspace
    const ranked = tabs
        .filter((t) => t.id != null && t.url?.includes(needle))
        .sort((a, b) => {
            const score = (u: string | undefined) => {
                if (!u) return 0
                if (u.includes('/customize/emoji')) return 3
                if (u.includes('/customize')) return 2
                if (u.includes('/client')) return 1
                return 0
            }
            return score(b.url) - score(a.url)
        })

    for (const tab of ranked) {
        if (tab.id == null) continue
        const result = await executePageEmojiList(tab.id)
        if (result?.ok) return result
        // keep last error but continue trying other tabs
        if (result && !result.ok && result.error !== 'token_not_found') {
            // still try other tabs
        }
    }
    return null
}

async function listEmojiViaTempTab(teamdomain: string): Promise<PageEmojiListResult | null> {
    const api = getExtApi()
    if (!api.tabs?.create) return null

    const urls = [
        `https://${teamdomain}.slack.com/customize/emoji`,
        `https://${teamdomain}.slack.com/`,
    ]

    for (const url of urls) {
        let tabId: number | undefined
        try {
            const tab = await api.tabs.create({url, active: false})
            tabId = tab.id
            if (tabId == null) continue
            await waitForTabComplete(tabId)
            // SPA boot_data often appears after "complete"
            await new Promise((r) => setTimeout(r, 1500))
            const result = await executePageEmojiList(tabId)
            if (result?.ok) return result
            if (result && !result.ok && result.error !== 'token_not_found') {
                return result
            }
        } catch {
            /* try next url */
        } finally {
            if (tabId != null) {
                try {
                    await api.tabs.remove(tabId)
                } catch {
                    /* ignore */
                }
            }
        }
    }
    return null
}

export function invalidateEmojiCache(teamdomain?: string) {
    if (teamdomain) emojiCache.delete(teamdomain.toLowerCase())
    else emojiCache.clear()
}

export async function listEmoji(teamdomain: string): Promise<ListEmojiResult> {
    const domain = teamdomain.trim().toLowerCase()
    if (!domain || !/^[a-z0-9][a-z0-9-]*$/.test(domain)) {
        return {ok: false, error: 'team_not_found'}
    }

    const cached = emojiCache.get(domain)
    if (cached && Date.now() - cached.at < EMOJI_CACHE_TTL_MS) {
        return {ok: true, emoji: cached.emoji}
    }

    // 1) Background fetch (works on Firefox when cookies attach to SW/page fetch)
    const customizeUrl = `https://${domain}.slack.com/customize/emoji`
    const fetched = await fetchText(customizeUrl)
    if (fetched) {
        const token = extractApiToken(fetched)
        if (token) {
            const emoji = await callEmojiListApi(domain, token)
            if (emoji) {
                emojiCache.set(domain, {at: Date.now(), emoji})
                return {ok: true, emoji}
            }
        }
    }

    // 2) Existing workspace tabs — MAIN world page context (Chrome)
    const fromOpen = await listEmojiViaOpenTabs(domain)
    if (fromOpen?.ok) {
        const emoji = resolveEmojiMap(fromOpen.emoji)
        emojiCache.set(domain, {at: Date.now(), emoji})
        return {ok: true, emoji}
    }

    // 3) Temporary tab + MAIN world (Chrome when no open Slack tab)
    const fromTemp = await listEmojiViaTempTab(domain)
    if (fromTemp?.ok) {
        const emoji = resolveEmojiMap(fromTemp.emoji)
        emojiCache.set(domain, {at: Date.now(), emoji})
        return {ok: true, emoji}
    }

    if (fromOpen?.error === 'token_not_found' || fromTemp?.error === 'token_not_found') {
        return {ok: false, error: 'token_not_found'}
    }
    if (fromOpen?.error || fromTemp?.error) {
        return {ok: false, error: fromOpen?.error || fromTemp?.error || 'network'}
    }
    return {ok: false, error: 'token_not_found'}
}

export async function registerEmoji(
    payload: RegisterEmojiPayload,
): Promise<RegisterEmojiResult> {
    void payload
    // TODO(step-5): emoji.add via session token
    return {ok: false, error: 'unknown'}
}
