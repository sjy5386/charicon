import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import {ensureWebFontsLoaded} from './fontFallback.ts'
import {
    buildHangulRegSnapshot,
    filterHangulIndices,
    getHangulEntries,
    HANGUL_COUNT,
    REG_ALTERNATE,
    REG_BASE,
    REG_MISSING,
    type CatalogFilter,
} from './hangulCatalog.ts'
import {EMOJI_STYLE, localPreviewDataUrl} from './previewEmojiTile.ts'
import type {SlackExtensionState} from './slack/useSlackExtension'

export interface HangulEmojiCatalogProps {
    slack: SlackExtensionState
    filter: CatalogFilter
    setFilter: (filter: CatalogFilter) => void
    query: string
    setQuery: (query: string) => void
    /** Open generator with this hangul character. */
    onSelectCharacter?: (character: string) => void
}

/** Same as converter jumbo preview tile (.slack-preview.is-jumbo .slack-preview-emoji). */
const CELL = EMOJI_STYLE.jumbo.box
const GAP = 6
const OVERSCAN_ROWS = 6
const PREVIEW_MODE = 'jumbo' as const

const HangulEmojiCatalog = ({
    slack,
    filter,
    setFilter,
    query,
    setQuery,
    onSelectCharacter,
}: HangulEmojiCatalogProps) => {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [scrollTop, setScrollTop] = useState(0)
    const [viewportH, setViewportH] = useState(480)
    /** Content-box width (padding excluded) for full-bleed column spacing. */
    const [gridW, setGridW] = useState(0)
    /** Webfonts ready so glyph probes match converter local tiles. */
    const [webFontsReady, setWebFontsReady] = useState(false)

    useEffect(() => {
        void ensureWebFontsLoaded().then(() => setWebFontsReady(true))
    }, [])

    const slackReady = slack.status === 'ready' && !!slack.teamdomain
    const canResolve = slackReady && !slack.emojiLoading && !slack.emojiError

    const snapshot = useMemo(
        () => (canResolve ? buildHangulRegSnapshot(slack.emoji) : null),
        [canResolve, slack.emoji],
    )

    const entries = useMemo(() => getHangulEntries(), [])

    const indices = useMemo(
        () => filterHangulIndices(snapshot, filter, query),
        [snapshot, filter, query],
    )

    // Measure content box → cols + leftover absorbed into column gap (no right gutter)
    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const measure = () => {
            const cs = getComputedStyle(el)
            const padX =
                (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
            // clientWidth already excludes scrollbar; subtract padding for the grid area
            const w = Math.max(0, el.clientWidth - padX)
            setGridW(w)
            setViewportH(el.clientHeight)
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const onScroll = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        setScrollTop(el.scrollTop)
    }, [])

    // Fit as many 32px cells as possible with at least GAP between them; stretch gap to fill width
    const cols = Math.max(1, Math.floor((gridW + GAP) / (CELL + GAP)) || 1)
    const colGap =
        cols > 1 ? Math.max(GAP, (gridW - cols * CELL) / (cols - 1)) : 0
    const colStride = CELL + colGap
    // Single column: center in grid width
    const originX = cols === 1 ? Math.max(0, (gridW - CELL) / 2) : 0

    const rowCount = Math.max(1, Math.ceil(indices.length / cols))
    const rowStride = CELL + GAP
    const totalH = Math.max(0, rowCount * rowStride - GAP)

    const firstRow = Math.max(0, Math.floor(scrollTop / rowStride) - OVERSCAN_ROWS)
    const visibleRows =
        Math.ceil(viewportH / rowStride) + OVERSCAN_ROWS * 2
    const lastRow = Math.min(rowCount - 1, firstRow + visibleRows)

    const cells: {index: number; row: number; col: number}[] = []
    for (let row = firstRow; row <= lastRow; row++) {
        for (let col = 0; col < cols; col++) {
            const listIdx = row * cols + col
            if (listIdx >= indices.length) break
            cells.push({index: indices[listIdx]!, row, col})
        }
    }

    const registeredTotal = snapshot
        ? snapshot.baseCount + snapshot.alternateCount
        : null

    const statusHint = !slackReady
        ? 'Slack 확장·워크스페이스를 연결하면 등록 여부를 표시합니다.'
        : slack.emojiLoading
          ? '워크스페이스 이모지를 불러오는 중…'
          : slack.emojiError
            ? '이모지 목록을 불러오지 못했습니다. 도크에서 ↻ 후 다시 시도하세요.'
            : null

    return (
        <>
            <h1>글자티콘 목록</h1>
            <p className="catalog-lead">
                완성형 한글 <strong>{HANGUL_COUNT.toLocaleString('ko-KR')}</strong>자
                (가–힣) 등록 상태. 글자를 누르면 생성기로 이동합니다.
            </p>

            <div className="card catalog-card">
                <div className="catalog-toolbar">
                    <div className="catalog-stats" role="status">
                        {snapshot ? (
                            <>
                                <span className="catalog-stat catalog-stat--ok">
                                    등록 {registeredTotal!.toLocaleString('ko-KR')}
                                    <span className="catalog-stat__detail">
                                        (기본 {snapshot.baseCount.toLocaleString('ko-KR')}
                                        {snapshot.alternateCount > 0
                                            ? ` · 대체 ${snapshot.alternateCount.toLocaleString('ko-KR')}`
                                            : ''}
                                        )
                                    </span>
                                </span>
                                <span className="catalog-stat catalog-stat--miss">
                                    미등록 {snapshot.missingCount.toLocaleString('ko-KR')}
                                </span>
                            </>
                        ) : (
                            <span className="catalog-stat catalog-stat--muted">
                                {slack.emojiLoading ? (
                                    <>
                                        <span className="ui-spinner" aria-hidden />
                                        확인 중…
                                    </>
                                ) : (
                                    `전체 ${HANGUL_COUNT.toLocaleString('ko-KR')} · 등록 여부 미확인`
                                )}
                            </span>
                        )}
                        <span className="catalog-stat catalog-stat--muted">
                            표시 {indices.length.toLocaleString('ko-KR')}
                        </span>
                    </div>

                    <div className="catalog-filters" role="group" aria-label="등록 필터">
                        {(
                            [
                                ['all', '전체'],
                                ['registered', '등록됨'],
                                ['alternate', '대체만'],
                                ['missing', '미등록'],
                            ] as const
                        ).map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                className={filter === id ? 'is-active' : undefined}
                                aria-pressed={filter === id}
                                disabled={
                                    (id === 'registered' ||
                                        id === 'alternate' ||
                                        id === 'missing') &&
                                    !snapshot
                                }
                                onClick={() => setFilter(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="catalog-search">
                        <label htmlFor="catalog-query" className="visually-hidden">
                            글자 또는 이모지 이름 검색
                        </label>
                        <input
                            id="catalog-query"
                            type="search"
                            placeholder="글자 또는 이름 (예: 가, rk)"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {slackReady && (
                            <button
                                type="button"
                                className="catalog-refresh"
                                onClick={() => void slack.refreshEmoji()}
                                disabled={slack.emojiLoading}
                                title="이모지 목록 다시 불러오기"
                            >
                                {slack.emojiLoading ? (
                                    <span className="ui-spinner" aria-hidden />
                                ) : (
                                    '↻'
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {statusHint && (
                    <p className="catalog-hint" role="status">
                        {slack.emojiLoading && (
                            <span className="ui-spinner catalog-hint__spinner" aria-hidden />
                        )}
                        {statusHint}
                    </p>
                )}

                <div
                    ref={scrollRef}
                    className="catalog-scroll"
                    onScroll={onScroll}
                    role="list"
                    aria-label="한글 글자티콘 목록"
                >
                    {indices.length === 0 ? (
                        <p className="catalog-empty">조건에 맞는 글자가 없습니다.</p>
                    ) : (
                        <div
                            className="catalog-grid-spacer"
                            style={{height: totalH, position: 'relative'}}
                        >
                            {cells.map(({index, row, col}) => {
                                const e = entries[index]!
                                const k = snapshot ? snapshot.kind[index]! : -1
                                const emojiName =
                                    snapshot && snapshot.name[index]
                                        ? snapshot.name[index]!
                                        : e.base
                                const workspaceUrl =
                                    k === REG_BASE || k === REG_ALTERNATE
                                        ? slack.emoji[emojiName]
                                        : undefined

                                const title =
                                    k === REG_BASE
                                        ? `${e.char} :${emojiName}: 등록됨`
                                        : k === REG_ALTERNATE
                                          ? `${e.char} :${emojiName}: (기본 :${e.base}: 없음) — 생성기로`
                                          : k === REG_MISSING
                                            ? `${e.char} 미등록 :${e.base}: — 생성기로`
                                            : `${e.char} :${e.base}: — 생성기로`

                                // Converter: registered → Slack img; else local canvas tile
                                // (fillTextWithFontFallback: ChosunGs → Gungsuhche)
                                let tile: ReactNode
                                if (workspaceUrl) {
                                    tile = (
                                        <img
                                            src={workspaceUrl}
                                            alt={`:${emojiName}:`}
                                            draggable={false}
                                        />
                                    )
                                } else if (webFontsReady) {
                                    tile = (
                                        <img
                                            src={localPreviewDataUrl(e.char, PREVIEW_MODE)}
                                            alt={e.char}
                                            draggable={false}
                                        />
                                    )
                                } else {
                                    tile = (
                                        <span
                                            className="slack-preview-emoji__pending"
                                            aria-hidden
                                        />
                                    )
                                }

                                const statusClass =
                                    k === REG_BASE
                                        ? ''
                                        : k === REG_ALTERNATE
                                          ? 'is-alternate'
                                          : k === REG_MISSING
                                            ? 'is-missing'
                                            : canResolve
                                              ? 'is-missing'
                                              : 'is-unknown'

                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        role="listitem"
                                        className={[
                                            'slack-preview-emoji',
                                            'is-real',
                                            'is-clickable',
                                            'catalog-cell',
                                            statusClass,
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                        style={{
                                            width: CELL,
                                            height: CELL,
                                            left: originX + col * colStride,
                                            top: row * rowStride,
                                        }}
                                        title={title}
                                        aria-label={title}
                                        onClick={() => onSelectCharacter?.(e.char)}
                                    >
                                        {tile}
                                        {k === REG_ALTERNATE && (
                                            <span className="catalog-cell__badge" aria-hidden>
                                                대
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                <p className="catalog-legend">
                    <span className="catalog-legend__item">
                        <span className="catalog-legend__swatch is-registered" />
                        기본 이름 등록
                    </span>
                    <span className="catalog-legend__item">
                        <span className="catalog-legend__swatch is-alternate" />
                        대체 이름만
                    </span>
                    <span className="catalog-legend__item">
                        <span className="catalog-legend__swatch is-missing" />
                        미등록
                    </span>
                </p>
            </div>
        </>
    )
}

export default HangulEmojiCatalog
