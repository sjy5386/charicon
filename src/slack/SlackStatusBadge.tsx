import type {SlackExtensionState} from './useSlackExtension'

type Props = {
    slack: SlackExtensionState
}

const SlackStatusBadge = ({slack}: Props) => {
    const {status, version, teams, teamdomain, setTeamdomain, refreshTeams, lastError} = slack

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

    const selected = teams.find((t) => t.teamdomain === teamdomain)

    return (
        <div className="slack-badge slack-badge--ready" role="status">
            <span className="slack-badge__dot" aria-hidden />
            <span>확장 연결됨{version ? ` · v${version}` : ''}</span>
            {teams.length > 0 ? (
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
                <span className="slack-badge__hint">
                    {lastError === 'not_logged_in' || lastError === 'unknown'
                        ? '팀 목록은 다음 단계에서 연결됩니다'
                        : selected
                          ? selected.name
                          : '팀 목록 대기'}
                </span>
            )}
            <button
                type="button"
                className="slack-badge__refresh"
                onClick={() => void refreshTeams()}
                title="팀 목록 새로고침"
            >
                ↻
            </button>
        </div>
    )
}

export default SlackStatusBadge
