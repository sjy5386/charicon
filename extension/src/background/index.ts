import {
    CI_LIST_EMOJI,
    CI_LIST_EMOJI_DONE,
    CI_LIST_TEAMS,
    CI_LIST_TEAMS_DONE,
    CI_PING,
    CI_PONG,
    CI_REGISTER_EMOJI,
    CI_REGISTER_EMOJI_DONE,
    type RuntimeRequest,
    type RuntimeResponse,
} from '@shared/protocol'
import {getExtApi} from '../browser'
import {listEmoji, listTeams, registerEmoji} from './slack'

declare const __EXT_VERSION__: string

const {runtime} = getExtApi()

runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
    void handleMessage(message)
        .then((response) => {
            sendResponse(response)
        })
        .catch((err: unknown) => {
            const error = err instanceof Error ? err.message : 'unknown'
            sendResponse({
                type: CI_PONG,
                requestId: message?.requestId ?? '',
                ok: false,
                error,
            } satisfies RuntimeResponse)
        })
    // Keep the message channel open for async sendResponse (MV3).
    return true
})

async function handleMessage(message: RuntimeRequest): Promise<RuntimeResponse> {
    const {requestId} = message

    try {
        switch (message.type) {
            case CI_PING:
                return {
                    type: CI_PONG,
                    requestId,
                    ok: true,
                    version: typeof __EXT_VERSION__ !== 'undefined' ? __EXT_VERSION__ : '0.1.0',
                }

            case CI_LIST_TEAMS: {
                const result = await listTeams()
                return {type: CI_LIST_TEAMS_DONE, requestId, ...result}
            }

            case CI_LIST_EMOJI: {
                const result = await listEmoji(message.payload.teamdomain)
                return {type: CI_LIST_EMOJI_DONE, requestId, ...result}
            }

            case CI_REGISTER_EMOJI: {
                const result = await registerEmoji(message.payload)
                return {type: CI_REGISTER_EMOJI_DONE, requestId, ...result}
            }

            default:
                return {
                    type: CI_PONG,
                    requestId,
                    ok: false,
                    error: 'unknown',
                }
        }
    } catch (err) {
        const error = err instanceof Error ? err.message : 'unknown'
        switch (message.type) {
            case CI_LIST_TEAMS:
                return {type: CI_LIST_TEAMS_DONE, requestId, ok: false, error}
            case CI_LIST_EMOJI:
                return {type: CI_LIST_EMOJI_DONE, requestId, ok: false, error}
            case CI_REGISTER_EMOJI:
                return {type: CI_REGISTER_EMOJI_DONE, requestId, ok: false, error}
            default:
                return {type: CI_PONG, requestId, ok: false, error}
        }
    }
}
