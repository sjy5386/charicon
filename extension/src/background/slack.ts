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

export async function listEmoji(teamdomain: string): Promise<ListEmojiResult> {
    void teamdomain
    // Step 3: real emoji.list — empty map until then (ok so UI doesn't show error)
    return {ok: true, emoji: {}}
}

export async function registerEmoji(
    payload: RegisterEmojiPayload,
): Promise<RegisterEmojiResult> {
    void payload
    // TODO(step-5): emoji.add via session token
    return {ok: false, error: 'unknown'}
}
