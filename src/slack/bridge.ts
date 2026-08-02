import {
    BRIDGE_SOURCE_EXT,
    BRIDGE_SOURCE_PAGE,
    CI_LIST_EMOJI,
    CI_LIST_EMOJI_DONE,
    CI_LIST_TEAMS,
    CI_LIST_TEAMS_DONE,
    CI_PING,
    CI_PONG,
    CI_REGISTER_EMOJI,
    CI_REGISTER_EMOJI_DONE,
    type ListEmojiResult,
    type ListTeamsResult,
    type PongPayload,
    type RegisterEmojiPayload,
    type RegisterEmojiResult,
} from '@shared/protocol'

function requestId(): string {
    return crypto.randomUUID()
}

type ExtBridgeMessage = {
    source: typeof BRIDGE_SOURCE_EXT
    type: string
    requestId: string
    [key: string]: unknown
}

function isExtMessage(data: unknown): data is ExtBridgeMessage {
    if (!data || typeof data !== 'object') return false
    const msg = data as ExtBridgeMessage
    return (
        msg.source === BRIDGE_SOURCE_EXT &&
        typeof msg.type === 'string' &&
        typeof msg.requestId === 'string'
    )
}

function waitForResponse<T extends {requestId: string}>(
    responseType: string,
    id: string,
    timeoutMs: number,
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
            window.removeEventListener('message', onMessage)
            reject(Object.assign(new Error('timeout'), {code: 'timeout' as const}))
        }, timeoutMs)

        function onMessage(event: MessageEvent) {
            if (event.source !== window) return
            if (event.origin !== window.location.origin) return
            if (!isExtMessage(event.data)) return
            if (event.data.type !== responseType) return
            if (event.data.requestId !== id) return

            window.clearTimeout(timer)
            window.removeEventListener('message', onMessage)
            resolve(event.data as unknown as T)
        }

        window.addEventListener('message', onMessage)
    })
}

async function callBridge<TResult extends {requestId: string}>(
    requestType: string,
    responseType: string,
    payload: unknown | undefined,
    timeoutMs: number,
): Promise<TResult> {
    const id = requestId()
    const pending = waitForResponse<TResult>(responseType, id, timeoutMs)
    window.postMessage(
        {
            source: BRIDGE_SOURCE_PAGE,
            type: requestType,
            requestId: id,
            ...(payload !== undefined ? {payload} : {}),
        },
        window.location.origin,
    )
    return pending
}

function stripRequestId<T extends {requestId: string}>(res: T): Omit<T, 'requestId'> {
    const {requestId: _, ...rest} = res
    void _
    return rest
}

export async function ping(timeoutMs = 2500): Promise<PongPayload> {
    try {
        const res = await callBridge<PongPayload & {requestId: string}>(
            CI_PING,
            CI_PONG,
            undefined,
            timeoutMs,
        )
        if ('ok' in res && res.ok) {
            return {ok: true, version: String(res.version)}
        }
        return {ok: false, error: 'error' in res ? String(res.error) : 'not_connected'}
    } catch {
        return {ok: false, error: 'not_connected'}
    }
}

export async function listTeams(timeoutMs = 15000): Promise<ListTeamsResult> {
    try {
        const res = await callBridge<ListTeamsResult & {requestId: string}>(
            CI_LIST_TEAMS,
            CI_LIST_TEAMS_DONE,
            undefined,
            timeoutMs,
        )
        return stripRequestId(res) as ListTeamsResult
    } catch (err) {
        const code = (err as {code?: string}).code
        return {ok: false, error: code === 'timeout' ? 'timeout' : 'not_connected'}
    }
}

export async function listEmoji(
    teamdomain: string,
    // Chrome may open a Slack tab + wait for SPA boot; keep this above that budget.
    timeoutMs = 45000,
): Promise<ListEmojiResult> {
    try {
        const res = await callBridge<ListEmojiResult & {requestId: string}>(
            CI_LIST_EMOJI,
            CI_LIST_EMOJI_DONE,
            {teamdomain},
            timeoutMs,
        )
        return stripRequestId(res) as ListEmojiResult
    } catch (err) {
        const code = (err as {code?: string}).code
        return {ok: false, error: code === 'timeout' ? 'timeout' : 'not_connected'}
    }
}

export async function registerEmoji(
    payload: RegisterEmojiPayload,
    timeoutMs = 30000,
): Promise<RegisterEmojiResult> {
    try {
        const res = await callBridge<RegisterEmojiResult & {requestId: string}>(
            CI_REGISTER_EMOJI,
            CI_REGISTER_EMOJI_DONE,
            payload,
            timeoutMs,
        )
        return stripRequestId(res) as RegisterEmojiResult
    } catch (err) {
        const code = (err as {code?: string}).code
        return {ok: false, error: code === 'timeout' ? 'timeout' : 'not_connected'}
    }
}
