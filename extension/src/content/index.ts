import {
    BRIDGE_SOURCE_EXT,
    BRIDGE_SOURCE_PAGE,
    CHARICON_APP_ID,
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
import {runtimeSendMessage} from '../browser'

const PAGE_TO_RUNTIME: Record<string, RuntimeRequest['type']> = {
    [CI_PING]: CI_PING,
    [CI_LIST_TEAMS]: CI_LIST_TEAMS,
    [CI_LIST_EMOJI]: CI_LIST_EMOJI,
    [CI_REGISTER_EMOJI]: CI_REGISTER_EMOJI,
}

const RUNTIME_TO_PAGE: Record<string, string> = {
    [CI_PONG]: CI_PONG,
    [CI_LIST_TEAMS_DONE]: CI_LIST_TEAMS_DONE,
    [CI_LIST_EMOJI_DONE]: CI_LIST_EMOJI_DONE,
    [CI_REGISTER_EMOJI_DONE]: CI_REGISTER_EMOJI_DONE,
}

type PageBridgeMessage = {
    source: typeof BRIDGE_SOURCE_PAGE
    type: string
    requestId: string
    payload?: unknown
}

function isOurPage(data: unknown): data is PageBridgeMessage {
    if (!data || typeof data !== 'object') return false
    const msg = data as PageBridgeMessage
    return (
        msg.source === BRIDGE_SOURCE_PAGE &&
        typeof msg.type === 'string' &&
        typeof msg.requestId === 'string'
    )
}

function isChariconPage(): boolean {
    return document.documentElement.dataset.chariconAppId === CHARICON_APP_ID
}

function fallbackDoneType(requestType: RuntimeRequest['type']): string {
    switch (requestType) {
        case CI_LIST_TEAMS:
            return CI_LIST_TEAMS_DONE
        case CI_LIST_EMOJI:
            return CI_LIST_EMOJI_DONE
        case CI_REGISTER_EMOJI:
            return CI_REGISTER_EMOJI_DONE
        default:
            return CI_PONG
    }
}

function replyToPage(detail: Record<string, unknown>) {
    window.postMessage(
        {
            source: BRIDGE_SOURCE_EXT,
            ...detail,
        },
        window.location.origin,
    )
}

async function handlePageMessage(msg: PageBridgeMessage) {
    if (!isChariconPage()) return

    const type = PAGE_TO_RUNTIME[msg.type]
    if (!type) return

    const message = {
        type,
        requestId: msg.requestId,
        ...(msg.payload !== undefined ? {payload: msg.payload} : {}),
    } as RuntimeRequest

    try {
        const response = await runtimeSendMessage<RuntimeResponse>(message)
        if (!response) {
            replyToPage({
                type: fallbackDoneType(type),
                requestId: msg.requestId,
                ok: false,
                error: 'not_connected',
            })
            return
        }
        const pageType = RUNTIME_TO_PAGE[response.type] ?? response.type
        replyToPage({...response, type: pageType})
    } catch {
        replyToPage({
            type: fallbackDoneType(type),
            requestId: msg.requestId,
            ok: false,
            error: 'not_connected',
        })
    }
}

function main() {
    window.addEventListener('message', (event: MessageEvent) => {
        if (event.source !== window) return
        if (event.origin !== window.location.origin) return
        if (!isOurPage(event.data)) return
        void handlePageMessage(event.data)
    })
}

main()
