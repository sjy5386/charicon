import * as React from 'react'
import {useEffect, useMemo, useRef, useState} from 'react'
import emojiRegex from 'emoji-regex'
import {
    hangulToSlackEmoji,
    PUNCTUATION_SLACK_EMOJI,
    resolveHangulWorkspaceEmoji,
    setFaviconFromCanvas,
    setFaviconFromDataUrl,
} from './charicon.ts'
import {ensureWebFontsLoaded} from './fontFallback.ts'
import {
    drawPreviewEmojiToCanvas,
    localPreviewDataUrl,
    type EmojiPreviewMode,
} from './previewEmojiTile.ts'
import {
    loadNameByCharForWorkspace,
    saveNameByCharForWorkspace,
} from './slack/nameByCharStorage'
import type {SlackExtensionState} from './slack/useSlackExtension'

export interface SlackEmojiConverterProps {
    text: string
    setText: React.Dispatch<React.SetStateAction<string>>
    slack: SlackExtensionState
    /** Open generator with this hangul character (missing workspace emoji). */
    onCreateCharacter?: (character: string) => void
    /** Clear converter input (and its URL query). */
    onReset?: () => void
}

const isHangul = (ch: string) => {
    const code = ch.charCodeAt(0)
    return code >= 0xAC00 && code <= 0xD7A3
}

/** Complete hangul syllables only (custom emoji source). Jamo like ㅇ do not count. */
const HANGUL_SYLLABLE_RE = /[\uAC00-\uD7A3]/gu

/** `?` / `!` convert to Slack standard emoji, so they count as emoji-only. */
const PUNCTUATION_SLACK_RE = /[?!]/gu

/**
 * Slack-like jumbo when only complete hangul syllables / unicode emoji /
 * `?` `!` + whitespace.
 * Bare jamo (ㅇ, ㅋ, …) is not emoji-only → inline.
 * IME mid-composition flicker is handled by freezing size while composing.
 */
const isEmojiOnlyMessage = (text: string): boolean => {
    if (text.length === 0) return true // placeholder "글자티콘" is emoji-only

    const emojiRe = emojiRegex()
    const remainder = text
        .replace(emojiRe, '')
        .replace(HANGUL_SYLLABLE_RE, '')
        .replace(PUNCTUATION_SLACK_RE, '')
        .replace(/\s+/gu, '')

    if (remainder.length > 0) return false

    HANGUL_SYLLABLE_RE.lastIndex = 0
    PUNCTUATION_SLACK_RE.lastIndex = 0
    return emojiRegex().test(text) || HANGUL_SYLLABLE_RE.test(text) || PUNCTUATION_SLACK_RE.test(text)
}

/** First hangul in text (or placeholder), matching the preview order. */
const firstPreviewHangul = (text: string): string | null => {
    for (const ch of Array.from(text || '글자티콘')) {
        if (isHangul(ch)) return ch
    }
    return null
}

const SlackEmojiConverter = ({
    text,
    setText,
    slack,
    onCreateCharacter,
    onReset,
}: SlackEmojiConverterProps) => {
    const [copied, setCopied] = useState(false)
    const [composing, setComposing] = useState(false)
    const targetJumbo = isEmojiOnlyMessage(text)
    const [jumbo, setJumbo] = useState(targetJumbo)
    /**
     * Hangul character → chosen workspace emoji name (without colons).
     * Shared by every occurrence of that character, including ones typed later.
     * Persisted per Slack teamdomain in localStorage.
     */
    const [nameByChar, setNameByChar] = useState<Record<string, string>>({})
    /** Which hangul index has the variant picker open (UI only). */
    const [pickerIndex, setPickerIndex] = useState<number | null>(null)
    /** Webfonts ready so glyph probes are reliable for DOM font-family. */
    const [webFontsReady, setWebFontsReady] = useState(false)

    useEffect(() => {
        void ensureWebFontsLoaded().then(() => setWebFontsReady(true))
    }, [])

    const slackReady = slack.status === 'ready' && !!slack.teamdomain
    const emojiMap = slack.emoji
    const teamdomain = slack.teamdomain
    /** Avoid wiping storage when teamdomain changes before nameByChar is re-hydrated. */
    const skipNextNameByCharSave = useRef(false)

    // Load selections for the current workspace (and clear when disconnected)
    useEffect(() => {
        skipNextNameByCharSave.current = true
        setNameByChar(loadNameByCharForWorkspace(teamdomain))
        setPickerIndex(null)
    }, [teamdomain])

    // Persist after picks (per workspace)
    useEffect(() => {
        if (!teamdomain) return
        if (skipNextNameByCharSave.current) {
            skipNextNameByCharSave.current = false
            return
        }
        saveNameByCharForWorkspace(teamdomain, nameByChar)
    }, [teamdomain, nameByChar])

    // Close picker when input text changes (keep nameByChar so later inputs inherit)
    useEffect(() => {
        setPickerIndex(null)
    }, [text])

    // Close picker on outside click
    useEffect(() => {
        if (pickerIndex == null) return
        const onPointerDown = (e: PointerEvent) => {
            const el = e.target as Element | null
            if (!el) return
            if (el.closest('[data-emoji-picker]') || el.closest('[data-emoji-pick-trigger]')) {
                return
            }
            setPickerIndex(null)
        }
        document.addEventListener('pointerdown', onPointerDown)
        return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [pickerIndex])

    // Apply size from settled text; freeze while IME is composing (ㅇ→아).
    useEffect(() => {
        if (composing) return
        setJumbo(targetJumbo)
    }, [targetJumbo, composing])

    const result = useMemo(
        () => hangulToSlackEmoji(text, nameByChar, slackReady ? emojiMap : undefined),
        [text, nameByChar, slackReady, emojiMap],
    )
    const displayText = text || '글자티콘'
    const emojiMode: EmojiPreviewMode = jumbo ? 'jumbo' : 'inline'

    useEffect(() => {
        const ch = firstPreviewHangul(text)
        if (!ch) return

        const {registered, imageUrl} = resolveHangulWorkspaceEmoji(
            ch,
            slackReady ? emojiMap : undefined,
            text ? nameByChar[ch] : undefined,
        )

        if (registered && imageUrl) {
            setFaviconFromDataUrl(imageUrl)
            return
        }

        const apply = () => {
            setFaviconFromCanvas(drawPreviewEmojiToCanvas(ch, emojiMode))
        }

        void ensureWebFontsLoaded().then(apply, apply)
    }, [text, emojiMode, slackReady, emojiMap, nameByChar])

    const pickVariant = (character: string, chosen: string) => {
        setNameByChar((prev) => ({...prev, [character]: chosen}))
        setPickerIndex(null)
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(result).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }

    return (
        <>
            <div className="slack-preview-container">
                <div className={[
                    'slack-preview',
                    text ? '' : 'is-placeholder',
                    jumbo ? 'is-jumbo' : 'is-inline',
                ].filter(Boolean).join(' ')}>
                    {Array.from(displayText).map((ch, i) => {
                        const punct = PUNCTUATION_SLACK_EMOJI[ch]
                        if (punct) {
                            return (
                                <span
                                    key={i}
                                    className="slack-preview-emoji is-real"
                                    title={`:${punct.name}:`}
                                >
                                    {punct.glyph}
                                </span>
                            )
                        }

                        if (!isHangul(ch)) {
                            return <React.Fragment key={i}>{ch}</React.Fragment>
                        }

                        // Placeholder "글자티콘" — no char overrides / pickers
                        const resolved = resolveHangulWorkspaceEmoji(
                            ch,
                            slackReady ? emojiMap : undefined,
                            text ? nameByChar[ch] : undefined,
                        )
                        const {base, name, variants, registered, imageUrl} = resolved
                        // base missing + alternates only → still registered (first alt / override)
                        const canPick =
                            slackReady &&
                            !slack.emojiLoading &&
                            text.length > 0 &&
                            registered &&
                            variants.length > 1 &&
                            !!imageUrl

                        if (registered && imageUrl) {
                            if (canPick) {
                                const open = pickerIndex === i
                                const baseMissing = !variants.includes(base)
                                return (
                                    <span key={i} className="emoji-pick-wrap">
                                        <button
                                            type="button"
                                            data-emoji-pick-trigger
                                            className={[
                                                'slack-preview-emoji is-real is-clickable',
                                                open ? 'is-picker-open' : '',
                                            ].filter(Boolean).join(' ')}
                                            title={
                                                baseMissing
                                                    ? `:${name}: (기본 :${base}: 없음) — 이름 선택`
                                                    : `:${name}: — 클릭해서 이름 선택 (같은 글자 전부)`
                                            }
                                            aria-label={`${ch} :${name}:. 클릭하면 후보 선택. 같은 글자에 모두 적용`}
                                            aria-expanded={open}
                                            aria-haspopup="listbox"
                                            onClick={() =>
                                                setPickerIndex(open ? null : i)
                                            }
                                        >
                                            <img
                                                src={imageUrl}
                                                alt={`:${name}:`}
                                                draggable={false}
                                            />
                                        </button>
                                        {open && (
                                            <div
                                                className="emoji-variant-picker"
                                                data-emoji-picker
                                                role="listbox"
                                                aria-label={`${ch} 이모지 이름 선택`}
                                            >
                                                {variants.map((v) => {
                                                    const selected = v === name
                                                    const url = emojiMap[v]
                                                    return (
                                                        <button
                                                            key={v}
                                                            type="button"
                                                            role="option"
                                                            aria-selected={selected}
                                                            className={[
                                                                'emoji-variant-picker__item',
                                                                selected ? 'is-selected' : '',
                                                            ].filter(Boolean).join(' ')}
                                                            onClick={() => pickVariant(ch, v)}
                                                        >
                                                            {url ? (
                                                                <img
                                                                    src={url}
                                                                    alt=""
                                                                    className="emoji-variant-picker__img"
                                                                    draggable={false}
                                                                />
                                                            ) : (
                                                                <span className="emoji-variant-picker__img-placeholder"/>
                                                            )}
                                                            <span className="emoji-variant-picker__name">
                                                                :{v}:
                                                            </span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </span>
                                )
                            }
                            return (
                                <span
                                    key={i}
                                    className="slack-preview-emoji is-real"
                                    title={
                                        !variants.includes(base)
                                            ? `:${name}: (기본 :${base}: 없음)`
                                            : `:${name}:`
                                    }
                                >
                                    <img src={imageUrl} alt={`:${name}:`} draggable={false}/>
                                </span>
                            )
                        }

                        // No base and no allowed alternates → local canvas tile
                        // (ChosunGs → Gungsuhche + optical scale; matches favicon/generator)
                        const canCreate =
                            slackReady &&
                            !slack.emojiLoading &&
                            !slack.emojiError &&
                            !!onCreateCharacter &&
                            text.length > 0

                        const localSrc = webFontsReady
                            ? localPreviewDataUrl(ch, emojiMode)
                            : undefined
                        const localImg = localSrc ? (
                            <img src={localSrc} alt={ch} draggable={false}/>
                        ) : (
                            // Fonts not ready yet — avoid empty ChosunGs .notdef
                            <span className="slack-preview-emoji__pending" aria-hidden/>
                        )

                        if (canCreate) {
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    className="slack-preview-emoji is-real is-missing is-clickable"
                                    title={`미등록 :${base}: — 클릭하면 생성기로 이동`}
                                    aria-label={`${ch} 미등록. 생성기에서 만들기`}
                                    onClick={() => onCreateCharacter(ch)}
                                >
                                    {localImg}
                                </button>
                            )
                        }

                        return (
                            <span
                                key={i}
                                className={[
                                    'slack-preview-emoji is-real',
                                    slackReady && !slack.emojiLoading ? 'is-missing' : '',
                                ].filter(Boolean).join(' ')}
                                title={
                                    slackReady
                                        ? `미등록 :${base}:`
                                        : undefined
                                }
                            >
                                {localImg}
                            </span>
                        )
                    })}
                </div>
                {slackReady && (slack.emojiLoading || slack.emojiError) && (
                    <p className="converter-preview-hint">
                        {slack.emojiLoading
                            ? '워크스페이스 이모지 불러오는 중…'
                            : '워크스페이스 이모지를 불러오지 못했습니다. ↻ 후 다시 시도하세요.'}
                    </p>
                )}
            </div>

            <h1>글자티콘 변환기</h1>
            <div className="card">
                <div className="input-group-vertical">
                    <div className="converter-field">
                        <label>입력</label>
                        <textarea rows={3} placeholder="글자티콘"
                                  value={text}
                                  onChange={(e) => setText(e.target.value)}
                                  onCompositionStart={() => setComposing(true)}
                                  onCompositionEnd={() => setComposing(false)}/>
                    </div>
                    <div className="converter-arrow">↓</div>
                    <div className="converter-field">
                        <label>결과</label>
                        <textarea rows={3} readOnly placeholder=":rmf::wk::xl::zhs:"
                                  value={result}/>
                    </div>
                </div>
                <div className="converter-actions">
                    {onReset && (
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={onReset}
                            title="입력을 비웁니다"
                        >
                            초기화
                        </button>
                    )}
                    <button
                        type="button"
                        className={copied ? 'is-success' : undefined}
                        onClick={handleCopy}
                        disabled={!result}
                    >
                        {copied ? '복사됨' : '복사'}
                    </button>
                </div>
            </div>
        </>
    )
}

export default SlackEmojiConverter
