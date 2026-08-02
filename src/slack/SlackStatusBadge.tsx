import type {SlackExtensionState} from './useSlackExtension'

type Props = {
    slack: SlackExtensionState
}

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

    if (status === 'checking') {
        return (
            <div className="slack-badge slack-badge--muted" role="status">
                Slack 확장 확인 중…
            </div>
        )
    }

    if (status === 'missing') {
        return (
            <div className="slack-badge slack-badge--warn" role="status">
                <span>
                    Slack 확장이 없습니다. 설치하면 워크스페이스에 바로 등록·미리보기할 수 있어요.
                </span>
                <span className="slack-badge__hint">
                    로컬: <code>extension/dist</code> 를 Chrome/Firefox에 로드
                </span>
            </div>
        )
    }

    return (
        <div className="slack-badge slack-badge--ready" role="status">
            <span className="slack-badge__dot" aria-hidden />
            <span>확장 연결됨{version ? ` · v${version}` : ''}</span>
            {teamsLoading ? (
                <span className="slack-badge__hint slack-badge__hint--inline">
                    팀 목록 불러오는 중…
                </span>
            ) : teams.length > 0 ? (
                <label className="slack-badge__team">
                    <span className="visually-hidden">워크스페이스</span>
                    <select
                        value={teamdomain ?? ''}
                        onChange={(e) => setTeamdomain(e.target.value)}
                    >
                        {teams.map((t) => (
                            <option key={t.teamdomain} value={t.teamdomain}>
                                {t.name} ({t.teamdomain})
                            </option>
                        ))}
                    </select>
                </label>
            ) : (
                <span className="slack-badge__hint slack-badge__hint--inline">
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
                            후 ↻
                        </>
                    )}
                </span>
            )}
            {status === 'ready' && teamdomain && teams.length > 0 && (
                <span className="slack-badge__hint slack-badge__hint--inline">
                    {emojiLoading
                        ? '이모지 불러오는 중…'
                        : emojiError
                          ? '이모지 목록 실패'
                          : `이모지 ${Object.keys(emoji).length}개`}
                </span>
            )}
            <button
                type="button"
                className="slack-badge__refresh"
                onClick={() => {
                    void refreshTeams().then(() => refreshEmoji())
                }}
                title="팀·이모지 새로고침"
                disabled={teamsLoading || emojiLoading}
            >
                ↻
            </button>
        </div>
    )
}

export default SlackStatusBadge
