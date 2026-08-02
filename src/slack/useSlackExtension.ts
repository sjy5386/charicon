import {useCallback, useEffect, useState} from 'react'
import type {Team} from '@shared/protocol'
import {listEmoji as bridgeListEmoji, listTeams as bridgeListTeams, ping} from './bridge'

const TEAM_STORAGE_KEY = 'charicon.slack.teamdomain'

export type SlackExtensionStatus = 'checking' | 'missing' | 'ready' | 'error'

export type SlackExtensionState = {
    status: SlackExtensionStatus
    version: string | null
    teams: Team[]
    teamdomain: string | null
    emoji: Record<string, string>
    emojiLoading: boolean
    lastError: string | null
    setTeamdomain: (teamdomain: string) => void
    refreshTeams: () => Promise<void>
    refreshEmoji: () => Promise<void>
}

export function useSlackExtension(): SlackExtensionState {
    const [status, setStatus] = useState<SlackExtensionStatus>('checking')
    const [version, setVersion] = useState<string | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [teamdomain, setTeamdomainState] = useState<string | null>(() => {
        try {
            return localStorage.getItem(TEAM_STORAGE_KEY)
        } catch {
            return null
        }
    })
    const [emoji, setEmoji] = useState<Record<string, string>>({})
    const [emojiLoading, setEmojiLoading] = useState(false)
    const [lastError, setLastError] = useState<string | null>(null)

    const setTeamdomain = useCallback((next: string) => {
        setTeamdomainState(next)
        try {
            localStorage.setItem(TEAM_STORAGE_KEY, next)
        } catch {
            /* ignore */
        }
    }, [])

    const refreshTeams = useCallback(async () => {
        const result = await bridgeListTeams()
        if (!result.ok) {
            setLastError(result.error)
            setTeams([])
            return
        }
        setLastError(null)
        setTeams(result.teams)

        setTeamdomainState((prev) => {
            const stored = prev
            if (stored && result.teams.some((t) => t.teamdomain === stored)) {
                return stored
            }
            const first = result.teams[0]?.teamdomain ?? null
            if (first) {
                try {
                    localStorage.setItem(TEAM_STORAGE_KEY, first)
                } catch {
                    /* ignore */
                }
            }
            return first
        })
    }, [])

    const refreshEmoji = useCallback(async () => {
        if (!teamdomain) {
            setEmoji({})
            return
        }
        setEmojiLoading(true)
        try {
            const result = await bridgeListEmoji(teamdomain)
            if (!result.ok) {
                setLastError(result.error)
                setEmoji({})
                return
            }
            setLastError(null)
            setEmoji(result.emoji)
        } finally {
            setEmojiLoading(false)
        }
    }, [teamdomain])

    // Detect extension
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const result = await ping()
            if (cancelled) return
            if (result.ok) {
                setStatus('ready')
                setVersion(result.version)
                setLastError(null)
            } else {
                setStatus('missing')
                setVersion(null)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    // Load teams when connected
    useEffect(() => {
        if (status !== 'ready') return
        void refreshTeams()
    }, [status, refreshTeams])

    // Load emoji when team changes (step 3 will fill real data)
    useEffect(() => {
        if (status !== 'ready' || !teamdomain) return
        void refreshEmoji()
    }, [status, teamdomain, refreshEmoji])

    return {
        status,
        version,
        teams,
        teamdomain,
        emoji,
        emojiLoading,
        lastError,
        setTeamdomain,
        refreshTeams,
        refreshEmoji,
    }
}
