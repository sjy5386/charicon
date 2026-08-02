/** Shared web ↔ extension bridge protocol (no backend). */

export const CHARICON_APP_ID = 'charicon-v1'

/**
 * window.postMessage sources (CustomEvent.detail is unreliable in Firefox
 * across page ↔ content-script worlds).
 */
export const BRIDGE_SOURCE_PAGE = 'charicon-page'
export const BRIDGE_SOURCE_EXT = 'charicon-extension'

/** Extension package version echoed in PONG (keep in sync with extension/package.json). */
export const EXTENSION_VERSION = '0.1.0'

/** Page ↔ content CustomEvent names / runtime message types */
export const CI_PING = 'CI_PING'
export const CI_PONG = 'CI_PONG'
export const CI_LIST_TEAMS = 'CI_LIST_TEAMS'
export const CI_LIST_TEAMS_DONE = 'CI_LIST_TEAMS_DONE'
export const CI_LIST_EMOJI = 'CI_LIST_EMOJI'
export const CI_LIST_EMOJI_DONE = 'CI_LIST_EMOJI_DONE'
export const CI_REGISTER_EMOJI = 'CI_REGISTER_EMOJI'
export const CI_REGISTER_EMOJI_DONE = 'CI_REGISTER_EMOJI_DONE'

export type Team = {
    name: string
    teamdomain: string
}

export type SlackBridgeError =
    | 'not_connected'
    | 'not_logged_in'
    | 'team_not_found'
    | 'token_not_found'
    | 'emoji_exists'
    | 'invalid_name'
    | 'invalid_image'
    | 'network'
    | 'timeout'
    | 'unknown'
    | string

export type BridgeEnvelope<T = unknown> = {
    requestId: string
    payload?: T
}

export type PingPayload = Record<string, never>

export type PongPayload =
    | {ok: true; version: string}
    | {ok: false; error: SlackBridgeError}

export type ListTeamsPayload = Record<string, never>

export type ListTeamsResult =
    | {ok: true; teams: Team[]}
    | {ok: false; error: SlackBridgeError}

export type ListEmojiPayload = {
    teamdomain: string
}

export type ListEmojiResult =
    | {ok: true; emoji: Record<string, string>}
    | {ok: false; error: SlackBridgeError}

export type RegisterEmojiPayload = {
    teamdomain: string
    /** Custom emoji name without colons, e.g. "rk" */
    name: string
    imageDataUrl: string
}

export type RegisterEmojiResult =
    | {ok: true}
    | {ok: false; error: SlackBridgeError}

/** Messages between content script and background (chrome.runtime). */
export type RuntimeRequest =
    | {type: typeof CI_PING; requestId: string}
    | {type: typeof CI_LIST_TEAMS; requestId: string}
    | {type: typeof CI_LIST_EMOJI; requestId: string; payload: ListEmojiPayload}
    | {type: typeof CI_REGISTER_EMOJI; requestId: string; payload: RegisterEmojiPayload}

export type RuntimeResponse =
    | ({type: typeof CI_PONG; requestId: string} & PongPayload)
    | ({type: typeof CI_LIST_TEAMS_DONE; requestId: string} & ListTeamsResult)
    | ({type: typeof CI_LIST_EMOJI_DONE; requestId: string} & ListEmojiResult)
    | ({type: typeof CI_REGISTER_EMOJI_DONE; requestId: string} & RegisterEmojiResult)
