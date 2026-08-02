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

async function fetchText(url: string, timeoutMs = 6000): Promise<string | null> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
        const res = await fetch(url, {
            credentials: 'include',
            redirect: 'follow',
            cache: 'no-store',
            signal: ctrl.signal,
            headers: {
                Accept: 'text/html,application/xhtml+xml',
            },
        })
        if (!res.ok) return null
        return await res.text()
    } catch {
        return null
    } finally {
        clearTimeout(timer)
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
/** In-memory only lasts while SW is alive — Chrome kills SW often. */
const emojiCache = new Map<string, EmojiCacheEntry>()
const EMOJI_CACHE_TTL_MS = 30 * 60 * 1000
const EMOJI_STORAGE_KEY = 'charicon.emojiCache.v1'

/** Dedupe concurrent listEmoji (React StrictMode double-mount, ↻ spam). */
const listEmojiInflight = new Map<string, Promise<ListEmojiResult>>()

type PageEmojiListResult =
    | {ok: true; emoji: Record<string, string>}
    | {ok: false; error: string}

type StoredEmojiCache = Record<string, EmojiCacheEntry>

async function readStoredEmoji(domain: string): Promise<Record<string, string> | null> {
    const api = getExtApi()
    const store = api.storage?.session ?? api.storage?.local
    if (!store?.get) return null
    try {
        const data = await store.get(EMOJI_STORAGE_KEY)
        const all = data[EMOJI_STORAGE_KEY] as StoredEmojiCache | undefined
        const entry = all?.[domain]
        if (!entry?.emoji || Date.now() - entry.at >= EMOJI_CACHE_TTL_MS) return null
        return entry.emoji
    } catch {
        return null
    }
}

async function writeStoredEmoji(domain: string, emoji: Record<string, string>): Promise<void> {
    const api = getExtApi()
    const store = api.storage?.session ?? api.storage?.local
    if (!store?.get || !store?.set) return
    try {
        const data = await store.get(EMOJI_STORAGE_KEY)
        const all = (data[EMOJI_STORAGE_KEY] as StoredEmojiCache | undefined) ?? {}
        all[domain] = {at: Date.now(), emoji}
        await store.set({[EMOJI_STORAGE_KEY]: all})
    } catch {
        /* ignore quota / private mode */
    }
}

async function clearStoredEmoji(domain?: string): Promise<void> {
    const api = getExtApi()
    const store = api.storage?.session ?? api.storage?.local
    if (!store?.get || !store?.set) return
    try {
        if (!domain) {
            await store.remove?.(EMOJI_STORAGE_KEY)
            return
        }
        const data = await store.get(EMOJI_STORAGE_KEY)
        const all = (data[EMOJI_STORAGE_KEY] as StoredEmojiCache | undefined) ?? {}
        delete all[domain]
        await store.set({[EMOJI_STORAGE_KEY]: all})
    } catch {
        /* ignore */
    }
}

function rememberEmoji(domain: string, emoji: Record<string, string>): void {
    emojiCache.set(domain, {at: Date.now(), emoji})
    void writeStoredEmoji(domain, emoji)
}

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
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 8000)
        try {
            const body = new URLSearchParams({token})
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                cache: 'no-store',
                signal: ctrl.signal,
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
        } finally {
            clearTimeout(timer)
        }
    }
    return null
}

type PageJobState = {
    id: string
    done: boolean
    result: PageEmojiListResult | null
}

/**
 * MAIN-world: kick off emoji.list job (returns immediately).
 * Must be fully self-contained — Chrome re-parses func.toString() in the page,
 * so no closed-over outer constants (use string literals only).
 *
 * Chrome often fails to return values from async injected functions — so we
 * start work here and poll with pagePollEmojiJob (sync).
 */
function pageStartEmojiJob(teamdomainHint: string, maxWaitMs: number): boolean {
    // literal key only — do not reference outer-scope consts
    const jobKey = '__chariconEmojiJob'
    const g = window as unknown as Record<string, PageJobState | undefined>
    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const waitBudget = Math.max(500, Math.min(maxWaitMs || 10000, 20000))
    g[jobKey] = {id: jobId, done: false, result: null}

    const hint = (teamdomainHint || '').toLowerCase()

    void (async () => {
        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

        type SlackWin = {
            boot_data?: {
                api_token?: string
                team_url?: string
                domain?: string
            }
            TS?: {
                boot_data?: {api_token?: string; team_url?: string; domain?: string}
                model?: {
                    api_token?: string
                    team?: {domain?: string; url?: string}
                }
                tokens?: {api?: string}
            }
        }

        const win = () => window as unknown as SlackWin

        const domainFromUrl = (url: string | undefined): string | null => {
            if (!url) return null
            try {
                const m = new URL(url, location.origin).hostname.match(
                    /^([a-z0-9][a-z0-9-]*)\.slack\.com$/i,
                )
                if (!m) return null
                const d = m[1]!.toLowerCase()
                if (d === 'app' || d === 'api' || d === 'status') return null
                return d
            } catch {
                return null
            }
        }

        const pageTeamDomain = (): string | null => {
            const ww = win()
            const direct =
                ww.TS?.model?.team?.domain ||
                ww.boot_data?.domain ||
                ww.TS?.boot_data?.domain
            if (typeof direct === 'string' && direct.length > 0) return direct.toLowerCase()
            return (
                domainFromUrl(ww.TS?.model?.team?.url) ||
                domainFromUrl(ww.boot_data?.team_url) ||
                domainFromUrl(ww.TS?.boot_data?.team_url) ||
                domainFromUrl(location.href)
            )
        }

        const getToken = (): string | null => {
            const ww = win()
            for (const c of [
                ww.boot_data?.api_token,
                ww.TS?.boot_data?.api_token,
                ww.TS?.model?.api_token,
                ww.TS?.tokens?.api,
            ]) {
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
                if (m?.[1] && m[1].length >= 8) return m[1]
            }
            return null
        }

        const finish = (result: PageEmojiListResult) => {
            const cur = g[jobKey]
            if (!cur || cur.id !== jobId) return
            g[jobKey] = {id: jobId, done: true, result}
        }

        try {
            const deadline = Date.now() + waitBudget
            let token: string | null = null
            let pageDomain: string | null = null
            while (Date.now() < deadline) {
                token = getToken()
                pageDomain = pageTeamDomain()
                if (token) break
                await sleep(200)
            }
            if (!token) {
                finish({ok: false, error: 'token_not_found'})
                return
            }

            const domain = hint || pageDomain || domainFromUrl(location.href)
            if (!domain) {
                finish({ok: false, error: 'team_not_found'})
                return
            }

            const urls = [
                `https://${domain}.slack.com/api/emoji.list`,
                pageDomain && pageDomain !== domain
                    ? `https://${pageDomain}.slack.com/api/emoji.list`
                    : null,
                `${location.origin}/api/emoji.list`,
                'https://slack.com/api/emoji.list',
                'https://app.slack.com/api/emoji.list',
            ].filter(Boolean) as string[]

            let lastError = 'network'
            for (const url of urls) {
                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        credentials: 'include',
                        cache: 'no-store',
                        headers: {
                            'Content-Type':
                                'application/x-www-form-urlencoded;charset=UTF-8',
                        },
                        body: new URLSearchParams({token}).toString(),
                    })
                    if (!res.ok) {
                        lastError = `http_${res.status}`
                        continue
                    }
                    const json = (await res.json()) as {
                        ok?: boolean
                        emoji?: Record<string, string>
                        error?: string
                    }
                    if (json.ok && json.emoji && typeof json.emoji === 'object') {
                        finish({ok: true, emoji: json.emoji})
                        return
                    }
                    if (json.error) lastError = String(json.error)
                } catch {
                    /* next */
                }
            }
            finish({ok: false, error: lastError})
        } catch (e) {
            finish({
                ok: false,
                error: e instanceof Error ? e.message : 'unknown',
            })
        }
    })()

    return true
}

/** MAIN-world: read job status. Sync — safe for Chrome executeScript. */
function pagePollEmojiJob(): PageEmojiListResult | 'pending' | null {
    const jobKey = '__chariconEmojiJob'
    const g = window as unknown as Record<string, PageJobState | undefined>
    const job = g[jobKey]
    if (!job) return null
    if (!job.done) return 'pending'
    return job.result
}

async function executePageEmojiList(
    tabId: number,
    teamdomain: string,
    maxWaitMs: number,
): Promise<PageEmojiListResult | null> {
    const api = getExtApi()
    if (!api.scripting?.executeScript) return null

    const start = async (world: 'MAIN' | 'ISOLATED') => {
        await api.scripting.executeScript({
            target: {tabId},
            world,
            func: pageStartEmojiJob,
            args: [teamdomain, maxWaitMs],
        })
    }

    const poll = async (world: 'MAIN' | 'ISOLATED') => {
        const results = await api.scripting.executeScript({
            target: {tabId},
            world,
            func: pagePollEmojiJob,
        })
        return results?.[0]?.result as PageEmojiListResult | 'pending' | null | undefined
    }

    let world: 'MAIN' | 'ISOLATED' = 'MAIN'
    try {
        await start('MAIN')
    } catch {
        world = 'ISOLATED'
        try {
            await start('ISOLATED')
        } catch {
            return null
        }
    }

    // Poll until job finishes (page work + a little slack for API)
    const deadline = Date.now() + maxWaitMs + 8000
    while (Date.now() < deadline) {
        try {
            const val = await poll(world)
            if (val === 'pending' || val == null) {
                await new Promise((r) => setTimeout(r, 250))
                continue
            }
            return val
        } catch {
            await new Promise((r) => setTimeout(r, 250))
        }
    }
    return {ok: false, error: 'token_not_found'}
}

function scoreSlackTab(url: string | undefined, teamdomain: string): number {
    if (!url) return -1
    let score = 0
    if (url.includes(`${teamdomain}.slack.com`)) score += 10
    if (url.includes('app.slack.com')) score += 6
    if (url.includes('/customize/emoji')) score += 5
    if (url.includes('/customize')) score += 3
    if (url.includes('/client')) score += 2
    if (url.includes('slack.com')) score += 1
    return score
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

    const ranked = tabs
        .filter((t) => t.id != null && scoreSlackTab(t.url, teamdomain) > 0)
        .sort(
            (a, b) =>
                scoreSlackTab(b.url, teamdomain) - scoreSlackTab(a.url, teamdomain),
        )
        // Best tab only — retries on many tabs caused flakiness + slowness
        .slice(0, 1)

    let lastFail: PageEmojiListResult | null = null
    for (const tab of ranked) {
        if (tab.id == null) continue
        const result = await executePageEmojiList(tab.id, teamdomain, 12000)
        if (result?.ok) return result
        if (result) lastFail = result
    }
    return lastFail
}

async function countSlackTabs(teamdomain: string): Promise<number> {
    const api = getExtApi()
    if (!api.tabs?.query) return 0
    try {
        const tabs = await api.tabs.query({})
        return tabs.filter((t) => scoreSlackTab(t.url, teamdomain) > 0).length
    } catch {
        return 0
    }
}

/** Single background tab — never open two (duplicate calls used to). */
async function listEmojiViaTempTab(teamdomain: string): Promise<PageEmojiListResult | null> {
    const api = getExtApi()
    if (!api.tabs?.create) return null

    const url = `https://${teamdomain}.slack.com/customize/emoji`
    let tabId: number | undefined
    try {
        const tab = await api.tabs.create({url, active: false})
        tabId = tab.id
        if (tabId == null) return null
        try {
            await waitForTabComplete(tabId)
        } catch {
            /* still try inject */
        }
        await new Promise((r) => setTimeout(r, 1200))
        return await executePageEmojiList(tabId, teamdomain, 14000)
    } catch {
        return null
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

export function invalidateEmojiCache(teamdomain?: string) {
    if (teamdomain) {
        const d = teamdomain.toLowerCase()
        emojiCache.delete(d)
        void clearStoredEmoji(d)
    } else {
        emojiCache.clear()
        void clearStoredEmoji()
    }
}

async function listEmojiUncached(domain: string): Promise<ListEmojiResult> {
    // 1) Existing Slack tab (best for Chrome — no extra tab flash)
    const fromOpen = await listEmojiViaOpenTabs(domain)
    if (fromOpen?.ok) {
        const emoji = resolveEmojiMap(fromOpen.emoji)
        rememberEmoji(domain, emoji)
        return {ok: true, emoji}
    }

    // 2) Background fetch (Firefox cookies; Chrome often empty — timeout-bounded)
    const customizeUrl = `https://${domain}.slack.com/customize/emoji`
    const fetched = await fetchText(customizeUrl, 5000)
    if (fetched) {
        const token = extractApiToken(fetched)
        if (token) {
            const emoji = await callEmojiListApi(domain, token)
            if (emoji) {
                rememberEmoji(domain, emoji)
                return {ok: true, emoji}
            }
        }
    }

    // 3) One temp tab only if we have no usable open tab result
    //    (opening two URLs / parallel calls was the "2 emoji settings tabs" bug)
    const fromTemp = await listEmojiViaTempTab(domain)
    if (fromTemp?.ok) {
        const emoji = resolveEmojiMap(fromTemp.emoji)
        rememberEmoji(domain, emoji)
        return {ok: true, emoji}
    }

    const err =
        fromTemp?.error ||
        fromOpen?.error ||
        ((await countSlackTabs(domain)) === 0
            ? 'token_not_found'
            : 'token_not_found')
    return {ok: false, error: err}
}

export async function listEmoji(teamdomain: string): Promise<ListEmojiResult> {
    const domain = teamdomain.trim().toLowerCase()
    if (!domain || !/^[a-z0-9][a-z0-9-]*$/.test(domain)) {
        return {ok: false, error: 'team_not_found'}
    }

    // Memory cache (fast path while SW alive)
    const mem = emojiCache.get(domain)
    if (mem && Date.now() - mem.at < EMOJI_CACHE_TTL_MS) {
        return {ok: true, emoji: mem.emoji}
    }

    // Session/local storage — survives Chrome SW restarts (main flake after refresh)
    const stored = await readStoredEmoji(domain)
    if (stored) {
        emojiCache.set(domain, {at: Date.now(), emoji: stored})
        return {ok: true, emoji: stored}
    }

    const existing = listEmojiInflight.get(domain)
    if (existing) return existing

    const pending = listEmojiUncached(domain).finally(() => {
        listEmojiInflight.delete(domain)
    })
    listEmojiInflight.set(domain, pending)
    return pending
}

// --- emoji.add (Step 5) ---

type PageRegisterResult =
    | {ok: true}
    | {ok: false; error: string}

function mapEmojiAddError(err: string): string {
    switch (err) {
        case 'error_name_taken':
        case 'name_taken':
            return 'emoji_exists'
        case 'error_invalid_name':
        case 'invalid_name':
            return 'invalid_name'
        case 'error_bad_image':
        case 'bad_image':
        case 'resized_but_still_too_large':
            return 'invalid_image'
        case 'no_permission':
        case 'not_allowed_token_type':
        case 'restricted_action':
            return 'no_permission'
        default:
            return err || 'unknown'
    }
}

function isValidEmojiName(name: string): boolean {
    return /^[a-z0-9][a-z0-9_-]{0,99}$/.test(name)
}

/**
 * MAIN-world: start emoji.add (self-contained; no outer consts).
 * Poll with pagePollRegisterJob.
 */
function pageStartRegisterJob(
    teamdomainHint: string,
    name: string,
    imageDataUrl: string,
    maxWaitMs: number,
): boolean {
    const jobKey = '__chariconRegisterJob'
    const g = window as unknown as Record<
        string,
        {id: string; done: boolean; result: PageRegisterResult | null} | undefined
    >
    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const waitBudget = Math.max(500, Math.min(maxWaitMs || 10000, 20000))
    g[jobKey] = {id: jobId, done: false, result: null}

    const hint = (teamdomainHint || '').toLowerCase()
    const emojiName = (name || '').toLowerCase()

    void (async () => {
        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

        type SlackWin = {
            boot_data?: {api_token?: string; domain?: string; team_url?: string}
            TS?: {
                boot_data?: {api_token?: string; domain?: string; team_url?: string}
                model?: {
                    api_token?: string
                    team?: {domain?: string; url?: string}
                }
                tokens?: {api?: string}
            }
        }

        const win = () => window as unknown as SlackWin

        const getToken = (): string | null => {
            const ww = win()
            for (const c of [
                ww.boot_data?.api_token,
                ww.TS?.boot_data?.api_token,
                ww.TS?.model?.api_token,
                ww.TS?.tokens?.api,
            ]) {
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
                if (m?.[1] && m[1].length >= 8) return m[1]
            }
            return null
        }

        const finish = (result: PageRegisterResult) => {
            const cur = g[jobKey]
            if (!cur || cur.id !== jobId) return
            g[jobKey] = {id: jobId, done: true, result}
        }

        try {
            if (!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(emojiName)) {
                finish({ok: false, error: 'invalid_name'})
                return
            }
            if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
                finish({ok: false, error: 'invalid_image'})
                return
            }

            const deadline = Date.now() + waitBudget
            let token: string | null = null
            while (Date.now() < deadline) {
                token = getToken()
                if (token) break
                await sleep(200)
            }
            if (!token) {
                finish({ok: false, error: 'token_not_found'})
                return
            }

            const domain = hint
            if (!domain) {
                finish({ok: false, error: 'team_not_found'})
                return
            }

            let blob: Blob
            try {
                const imgRes = await fetch(imageDataUrl)
                blob = await imgRes.blob()
            } catch {
                finish({ok: false, error: 'invalid_image'})
                return
            }

            const urls = [
                `https://${domain}.slack.com/api/emoji.add`,
                `${location.origin}/api/emoji.add`,
                'https://slack.com/api/emoji.add',
            ]

            let lastError = 'network'
            for (const url of urls) {
                try {
                    const fd = new FormData()
                    fd.append('mode', 'data')
                    fd.append('name', emojiName)
                    fd.append('image', blob, `${emojiName}.png`)
                    fd.append('token', token)
                    const res = await fetch(url, {
                        method: 'POST',
                        credentials: 'include',
                        body: fd,
                    })
                    if (!res.ok) {
                        lastError = `http_${res.status}`
                        continue
                    }
                    const json = (await res.json()) as {ok?: boolean; error?: string}
                    if (json.ok) {
                        finish({ok: true})
                        return
                    }
                    if (json.error) {
                        lastError = String(json.error)
                        // don't retry name_taken on other URLs
                        if (
                            json.error === 'error_name_taken' ||
                            json.error === 'name_taken'
                        ) {
                            break
                        }
                    }
                } catch {
                    /* next */
                }
            }

            // map common errors inline (no outer helpers)
            let mapped = lastError
            if (lastError === 'error_name_taken' || lastError === 'name_taken') {
                mapped = 'emoji_exists'
            } else if (
                lastError === 'error_invalid_name' ||
                lastError === 'invalid_name'
            ) {
                mapped = 'invalid_name'
            } else if (
                lastError === 'error_bad_image' ||
                lastError === 'bad_image'
            ) {
                mapped = 'invalid_image'
            } else if (
                lastError === 'no_permission' ||
                lastError === 'restricted_action'
            ) {
                mapped = 'no_permission'
            }
            finish({ok: false, error: mapped})
        } catch (e) {
            finish({
                ok: false,
                error: e instanceof Error ? e.message : 'unknown',
            })
        }
    })()

    return true
}

function pagePollRegisterJob(): PageRegisterResult | 'pending' | null {
    const jobKey = '__chariconRegisterJob'
    const g = window as unknown as Record<
        string,
        {id: string; done: boolean; result: PageRegisterResult | null} | undefined
    >
    const job = g[jobKey]
    if (!job) return null
    if (!job.done) return 'pending'
    return job.result
}

async function executePageRegister(
    tabId: number,
    teamdomain: string,
    name: string,
    imageDataUrl: string,
    maxWaitMs: number,
): Promise<PageRegisterResult | null> {
    const api = getExtApi()
    if (!api.scripting?.executeScript) return null

    const start = async (world: 'MAIN' | 'ISOLATED') => {
        await api.scripting.executeScript({
            target: {tabId},
            world,
            func: pageStartRegisterJob,
            args: [teamdomain, name, imageDataUrl, maxWaitMs],
        })
    }

    const poll = async (world: 'MAIN' | 'ISOLATED') => {
        const results = await api.scripting.executeScript({
            target: {tabId},
            world,
            func: pagePollRegisterJob,
        })
        return results?.[0]?.result as PageRegisterResult | 'pending' | null | undefined
    }

    let world: 'MAIN' | 'ISOLATED' = 'MAIN'
    try {
        await start('MAIN')
    } catch {
        world = 'ISOLATED'
        try {
            await start('ISOLATED')
        } catch {
            return null
        }
    }

    const deadline = Date.now() + maxWaitMs + 10000
    while (Date.now() < deadline) {
        try {
            const val = await poll(world)
            if (val === 'pending' || val == null) {
                await new Promise((r) => setTimeout(r, 250))
                continue
            }
            return val
        } catch {
            await new Promise((r) => setTimeout(r, 250))
        }
    }
    return {ok: false, error: 'timeout'}
}

async function registerEmojiViaFetch(
    payload: RegisterEmojiPayload,
): Promise<RegisterEmojiResult> {
    const domain = payload.teamdomain.trim().toLowerCase()
    const name = payload.name.trim().toLowerCase()
    if (!isValidEmojiName(name)) return {ok: false, error: 'invalid_name'}
    if (!payload.imageDataUrl.startsWith('data:image/')) {
        return {ok: false, error: 'invalid_image'}
    }

    const html = await fetchText(
        `https://${domain}.slack.com/customize/emoji`,
        8000,
    )
    if (!html) return {ok: false, error: 'token_not_found'}
    const token = extractApiToken(html)
    if (!token) return {ok: false, error: 'token_not_found'}

    let blob: Blob
    try {
        blob = await (await fetch(payload.imageDataUrl)).blob()
    } catch {
        return {ok: false, error: 'invalid_image'}
    }

    const fd = new FormData()
    fd.append('mode', 'data')
    fd.append('name', name)
    fd.append('image', blob, `${name}.png`)
    fd.append('token', token)

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    try {
        const res = await fetch(`https://${domain}.slack.com/api/emoji.add`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
            signal: ctrl.signal,
        })
        if (!res.ok) return {ok: false, error: 'network'}
        const json = (await res.json()) as {ok?: boolean; error?: string}
        if (json.ok) return {ok: true}
        return {ok: false, error: mapEmojiAddError(String(json.error || 'unknown'))}
    } catch {
        return {ok: false, error: 'network'}
    } finally {
        clearTimeout(timer)
    }
}

async function registerEmojiViaOpenTabs(
    payload: RegisterEmojiPayload,
): Promise<PageRegisterResult | null> {
    const api = getExtApi()
    if (!api.tabs?.query) return null
    const domain = payload.teamdomain.toLowerCase()
    let tabs: chrome.tabs.Tab[] = []
    try {
        tabs = await api.tabs.query({})
    } catch {
        return null
    }

    const ranked = tabs
        .filter((t) => t.id != null && scoreSlackTab(t.url, domain) > 0)
        .sort(
            (a, b) => scoreSlackTab(b.url, domain) - scoreSlackTab(a.url, domain),
        )
        .slice(0, 1)

    for (const tab of ranked) {
        if (tab.id == null) continue
        const result = await executePageRegister(
            tab.id,
            domain,
            payload.name,
            payload.imageDataUrl,
            12000,
        )
        if (result) return result
    }
    return null
}

async function registerEmojiViaTempTab(
    payload: RegisterEmojiPayload,
): Promise<PageRegisterResult | null> {
    const api = getExtApi()
    if (!api.tabs?.create) return null
    const domain = payload.teamdomain.toLowerCase()
    const url = `https://${domain}.slack.com/customize/emoji`
    let tabId: number | undefined
    try {
        const tab = await api.tabs.create({url, active: false})
        tabId = tab.id
        if (tabId == null) return null
        try {
            await waitForTabComplete(tabId)
        } catch {
            /* continue */
        }
        await new Promise((r) => setTimeout(r, 1200))
        return await executePageRegister(
            tabId,
            domain,
            payload.name,
            payload.imageDataUrl,
            14000,
        )
    } catch {
        return null
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

export async function registerEmoji(
    payload: RegisterEmojiPayload,
): Promise<RegisterEmojiResult> {
    const domain = (payload.teamdomain || '').trim().toLowerCase()
    const name = (payload.name || '').trim().toLowerCase()
    if (!domain || !/^[a-z0-9][a-z0-9-]*$/.test(domain)) {
        return {ok: false, error: 'team_not_found'}
    }
    if (!isValidEmojiName(name)) {
        return {ok: false, error: 'invalid_name'}
    }
    if (!payload.imageDataUrl?.startsWith('data:image/')) {
        return {ok: false, error: 'invalid_image'}
    }

    const normalized: RegisterEmojiPayload = {
        teamdomain: domain,
        name,
        imageDataUrl: payload.imageDataUrl,
    }

    // 1) Open Slack tab (Chrome-friendly)
    const fromOpen = await registerEmojiViaOpenTabs(normalized)
    if (fromOpen?.ok) {
        invalidateEmojiCache(domain)
        return {ok: true}
    }
    if (fromOpen && !fromOpen.ok && fromOpen.error === 'emoji_exists') {
        invalidateEmojiCache(domain)
        return {ok: false, error: 'emoji_exists'}
    }

    // 2) Background fetch (Firefox)
    const viaFetch = await registerEmojiViaFetch(normalized)
    if (viaFetch.ok) {
        invalidateEmojiCache(domain)
        return {ok: true}
    }
    if (viaFetch.error === 'emoji_exists') {
        invalidateEmojiCache(domain)
        return viaFetch
    }

    // 3) Temp customize tab
    const fromTemp = await registerEmojiViaTempTab(normalized)
    if (fromTemp?.ok) {
        invalidateEmojiCache(domain)
        return {ok: true}
    }

    const err =
        fromTemp?.error ||
        fromOpen?.error ||
        viaFetch.error ||
        'unknown'
    if (err === 'emoji_exists') invalidateEmojiCache(domain)
    return {ok: false, error: err}
}
