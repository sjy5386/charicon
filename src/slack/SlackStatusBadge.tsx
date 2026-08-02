import {useEffect, useRef, useState} from 'react'
import type {SlackExtensionState} from './useSlackExtension'

type Props = {
    slack: SlackExtensionState
}

const Spinner = ({className = ''}: {className?: string}) => (
    <span className={`ui-spinner ${className}`.trim()} aria-hidden />
)

/**
 * Secondary chrome for the browser extension — fixed dock, not in document flow,
 * so main generator/converter layout stays stable.
 */
const SlackStatusBadge = ({slack}: Props) => {
    const {
        status,
        version,
        teams,
        teamsLoading,
        teamdomain,
        setTeamdomain,
        refreshTeams,
        refreshEmoji,
        emoji,
        emojiLoading,
        emojiError,
        lastError,
    } = slack

    const [open, setOpen] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    const busy =
        status === 'checking' ||
        teamsLoading ||
        emojiLoading ||
        refreshing

    useEffect(() => {
        if (!open) return
        const onPointerDown = (e: PointerEvent) => {
            const el = e.target as Node | null
            if (el && rootRef.current && !rootRef.current.contains(el)) {
                setOpen(false)
            }
        }
        document.addEventListener('pointerdown', onPointerDown)
        return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [open])

    const teamLabel =
        teams.find((t) => t.teamdomain === teamdomain)?.name ??
        teamdomain ??
        null

    let statusKind: 'checking' | 'missing' | 'ready' | 'warn' = 'checking'
    let chipLabel = 'Slack'
    if (status === 'checking') {
        statusKind = 'checking'
        chipLabel = 'Slack'
    } else if (status === 'missing') {
        statusKind = 'missing'
        chipLabel = '확장 없음'
    } else if (teamsLoading || refreshing) {
        statusKind = 'ready'
        chipLabel = teamLabel ?? 'Slack'
    } else if (teams.length === 0) {
        statusKind = 'warn'
        chipLabel = '팀 없음'
    } else {
        statusKind = 'ready'
        chipLabel = teamLabel ?? '연결됨'
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            await refreshTeams()
            await refreshEmoji()
        } finally {
            setRefreshing(false)
        }
    }

    return (
        <div className="slack-dock" ref={rootRef}>
            {open && (
                <div className="slack-dock__panel" role="dialog" aria-label="Slack 확장">
                    <div className="slack-dock__panel-head">
                        <strong>Slack 확장</strong>
                        {version ? <span className="slack-dock__ver">v{version}</span> : null}
                    </div>

                    {status === 'checking' && (
                        <p className="slack-dock__line muted slack-dock__line--busy">
                            <Spinner />
                            확장 확인 중…
                        </p>
                    )}

                    {status === 'missing' && (
                        <div className="slack-dock__body">
                            <p className="slack-dock__line">
                                확장이 없습니다. 설치하면 워크스페이스에 바로 등록·미리보기할 수 있어요.
                            </p>
                            <p className="slack-dock__line muted">
                                로컬: <code>extension/dist</code> 를 Chrome/Firefox에 로드
                            </p>
                        </div>
                    )}

                    {status === 'ready' && (
                        <div className="slack-dock__body">
                            {teamsLoading ? (
                                <p className="slack-dock__line muted slack-dock__line--busy">
                                    <Spinner />
                                    팀 목록 불러오는 중…
                                </p>
                            ) : teams.length > 0 ? (
                                <label className="slack-dock__field">
                                    <span>워크스페이스</span>
                                    <select
                                        value={teamdomain ?? ''}
                                        onChange={(e) => setTeamdomain(e.target.value)}
                                        disabled={refreshing || emojiLoading}
                                    >
                                        {teams.map((t) => (
                                            <option key={t.teamdomain} value={t.teamdomain}>
                                                {t.name} ({t.teamdomain})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : (
                                <p className="slack-dock__line">
                                    {lastError === 'network' ? (
                                        'Slack에 연결하지 못했습니다'
                                    ) : (
                                        <>
                                            로그인된 워크스페이스 없음 ·{' '}
                                            <a
                                                href="https://slack.com/signin"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Slack 로그인
                                            </a>
                                        </>
                                    )}
                                </p>
                            )}

                            {teamdomain && teams.length > 0 && (
                                <p
                                    className={[
                                        'slack-dock__line muted',
                                        emojiLoading || refreshing ? 'slack-dock__line--busy' : '',
                                    ].filter(Boolean).join(' ')}
                                >
                                    {(emojiLoading || refreshing) && <Spinner />}
                                    {emojiLoading || refreshing
                                        ? '이모지 불러오는 중…'
                                        : emojiError
                                          ? `이모지 목록 실패 (${emojiError})`
                                          : `커스텀 이모지 ${Object.keys(emoji).length}개`}
                                </p>
                            )}

                            <div className="slack-dock__actions">
                                <button
                                    type="button"
                                    className="slack-dock__refresh"
                                    onClick={() => void handleRefresh()}
                                    disabled={teamsLoading || emojiLoading || refreshing}
                                    title="팀·이모지 새로고침"
                                    aria-label="팀·이모지 새로고침"
                                >
                                    {teamsLoading || emojiLoading || refreshing ? (
                                        <Spinner />
                                    ) : (
                                        <span className="slack-dock__refresh-icon" aria-hidden>
                                            ↻
                                        </span>
                                    )}
                                    <span>새로고침</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <button
                type="button"
                className={`slack-dock__chip slack-dock__chip--${statusKind}`}
                aria-expanded={open}
                aria-haspopup="dialog"
                title="Slack 확장 설정"
                onClick={() => setOpen((v) => !v)}
            >
                {busy ? (
                    <Spinner className="slack-dock__chip-spinner" />
                ) : (
                    <span className="slack-dock__chip-dot" aria-hidden />
                )}
                <span className="slack-dock__chip-label">{chipLabel}</span>
            </button>
        </div>
    )
}

export default SlackStatusBadge
