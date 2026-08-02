import type {
    ListEmojiResult,
    ListTeamsResult,
    RegisterEmojiPayload,
    RegisterEmojiResult,
} from '@shared/protocol'

/**
 * Slack session helpers (no backend; uses browser cookies).
 * listTeams / listEmoji / registerEmoji — real impl in later steps.
 * Step 1 only needs PING; these stubs keep the message router ready.
 */

export async function listTeams(): Promise<ListTeamsResult> {
    // TODO(step-2): scrape slack.com/signin loggedInTeams
    return {ok: false, error: 'unknown'}
}

export async function listEmoji(teamdomain: string): Promise<ListEmojiResult> {
    void teamdomain
    // TODO(step-3): emoji.list via session token
    return {ok: false, error: 'unknown'}
}

export async function registerEmoji(
    payload: RegisterEmojiPayload,
): Promise<RegisterEmojiResult> {
    void payload
    // TODO(step-5): emoji.add via session token
    return {ok: false, error: 'unknown'}
}
