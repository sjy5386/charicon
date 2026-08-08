import * as React from 'react'
import {useRef, useState} from 'react'
import {
    complementaryColor,
    downloadCanvas,
    hangulToQwerty,
    resolveHangulWorkspaceEmoji,
} from './charicon.ts'
import {cssFontStyleForChar} from './fontFallback.ts'
import Canvas, {Gradient} from "./Canvas.tsx"
import {registerEmoji} from './slack/bridge'
import type {SlackExtensionState} from './slack/useSlackExtension'

export interface CharIconGeneratorProps {
    character: string;
    setCharacter: React.Dispatch<React.SetStateAction<string>>;
    bgIsGradient: boolean;
    setBgIsGradient: React.Dispatch<React.SetStateAction<boolean>>;
    backgroundColor: string;
    setBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
    bgGradient: Gradient;
    setBgGradient: React.Dispatch<React.SetStateAction<Gradient>>;
    colorIsGradient: boolean;
    setColorIsGradient: React.Dispatch<React.SetStateAction<boolean>>;
    color: string;
    setColor: React.Dispatch<React.SetStateAction<string>>;
    colorGradient: Gradient;
    setColorGradient: React.Dispatch<React.SetStateAction<Gradient>>;
    fontSize: number;
    setFontSize: React.Dispatch<React.SetStateAction<number>>;
    x: number;
    setX: React.Dispatch<React.SetStateAction<number>>;
    y: number;
    setY: React.Dispatch<React.SetStateAction<number>>;
    slack: SlackExtensionState;
    onReset: () => void;
}

const GradientToggle = ({
                            value,
                            onChange,
                        }: {
    value: boolean
    onChange: (gradient: boolean) => void
}) => (
    <div className="gradient-toggle" role="group" aria-label="색상 모드">
        <button type="button" aria-pressed={!value} onClick={() => onChange(false)}>단색</button>
        <button type="button" aria-pressed={value} onClick={() => onChange(true)}>그라데이션</button>
    </div>
)

function registerErrorMessage(code: string): string {
    switch (code) {
        case 'emoji_exists':
            return '같은 이름의 이모지가 이미 있습니다.'
        case 'invalid_name':
            return '이모지 이름이 올바르지 않습니다.'
        case 'invalid_image':
            return '이미지 형식을 확인하세요.'
        case 'no_permission':
            return '이모지 추가 권한이 없습니다. 워크스페이스 설정을 확인하세요.'
        case 'token_not_found':
            return 'Slack 세션을 찾지 못했습니다. Slack 탭을 연 뒤 다시 시도하세요.'
        case 'not_connected':
            return '확장이 연결되지 않았습니다.'
        case 'timeout':
            return '응답이 지연됩니다. 잠시 후 다시 시도하세요.'
        case 'network':
            return '네트워크 오류가 발생했습니다.'
        default:
            return `등록에 실패했습니다 (${code})`
    }
}

const CharIconGenerator = ({
                               character, setCharacter,
                               bgIsGradient, setBgIsGradient,
                               backgroundColor, setBackgroundColor,
                               bgGradient, setBgGradient,
                               colorIsGradient, setColorIsGradient,
                               color, setColor,
                               colorGradient, setColorGradient,
                               fontSize, setFontSize,
                               x, setX, y, setY,
                               slack,
                               onReset,
                           }: CharIconGeneratorProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [downloaded, setDownloaded] = useState(false)
    const [registering, setRegistering] = useState(false)
    const [registerOk, setRegisterOk] = useState(false)
    const [registerError, setRegisterError] = useState<string | null>(null)
    const size = 100

    const emojiName = character ? hangulToQwerty(character) : ''
    const slackReady = slack.status === 'ready' && !!slack.teamdomain
    const workspaceEmoji = character && slackReady
        ? resolveHangulWorkspaceEmoji(character, slack.emoji)
        : null
    /** Base name registered (emoji.add uses hangulToQwerty). */
    const baseRegisteredUrl =
        emojiName && slackReady ? slack.emoji[emojiName] : undefined
    const registrationKnown =
        slackReady && !slack.emojiLoading && !slack.emojiError && !!emojiName
    const canRegister =
        slackReady &&
        !!emojiName &&
        registrationKnown &&
        !baseRegisteredUrl &&
        !registering

    const handleDownload = () => {
        downloadCanvas(canvasRef.current, hangulToQwerty(character) + '.png')
        setDownloaded(true)
        setTimeout(() => setDownloaded(false), 1500)
    }

    const handleRegister = async () => {
        if (!canvasRef.current || !slack.teamdomain || !emojiName || !canRegister) return
        setRegistering(true)
        setRegisterError(null)
        setRegisterOk(false)
        try {
            const imageDataUrl = canvasRef.current.toDataURL('image/png')
            const result = await registerEmoji({
                teamdomain: slack.teamdomain,
                name: emojiName,
                imageDataUrl,
            })
            if (!result.ok) {
                setRegisterError(registerErrorMessage(result.error))
                return
            }
            setRegisterOk(true)
            await slack.refreshEmoji()
            setTimeout(() => setRegisterOk(false), 2000)
        } catch {
            setRegisterError(registerErrorMessage('unknown'))
        } finally {
            setRegistering(false)
        }
    }

    const statusThumb =
        workspaceEmoji?.registered && workspaceEmoji.imageUrl
            ? workspaceEmoji.imageUrl
            : baseRegisteredUrl

    return (
        <>
            <div className="canvas-container">
                <Canvas canvasRef={canvasRef} width={size} height={size} character={character}
                        backgroundColor={bgIsGradient ? bgGradient : backgroundColor}
                        color={colorIsGradient ? colorGradient : color}
                        fontSize={fontSize} setFontSize={setFontSize}
                        x={x} setX={setX} y={y} setY={setY}></Canvas>
            </div>

            <h1>글자티콘 생성기</h1>

            <div className="card">
                <div className="input-group-vertical">
                    <div className="input-item main-input">
                        <label>글자</label>
                        <input type="text" maxLength={1} value={character}
                               onChange={(e) => {
                                   setCharacter(e.target.value)
                                   setRegisterError(null)
                               }}/>
                    </div>
                    <div className="input-row">
                        <div className="input-item">
                            <label>배경색</label>
                            <GradientToggle
                                value={bgIsGradient}
                                onChange={(checked) => {
                                    setBgIsGradient(checked)
                                    if (checked) {
                                        setBgGradient({
                                            start: backgroundColor,
                                            end: complementaryColor(backgroundColor),
                                        })
                                    }
                                }}
                            />
                            {bgIsGradient ? (
                                <div style={{display: 'flex', gap: '4px'}}>
                                    <input type="color" value={bgGradient.start}
                                           onChange={(e) => setBgGradient({
                                               start: e.target.value,
                                               end: complementaryColor(e.target.value),
                                           })}/>
                                    <input type="color" value={bgGradient.end}
                                           onChange={(e) => setBgGradient({...bgGradient, end: e.target.value})}/>
                                </div>
                            ) : (
                                <input type="color" value={backgroundColor}
                                       onChange={(e) => setBackgroundColor(e.target.value)}/>
                            )}
                        </div>
                        <div className="input-item">
                            <label>글자색</label>
                            <GradientToggle
                                value={colorIsGradient}
                                onChange={(checked) => {
                                    setColorIsGradient(checked)
                                    if (checked) {
                                        setColorGradient({
                                            start: color,
                                            end: complementaryColor(color),
                                        })
                                    }
                                }}
                            />
                            {colorIsGradient ? (
                                <div style={{display: 'flex', gap: '4px'}}>
                                    <input type="color" value={colorGradient.start}
                                           onChange={(e) => setColorGradient({
                                               start: e.target.value,
                                               end: complementaryColor(e.target.value),
                                           })}/>
                                    <input type="color" value={colorGradient.end}
                                           onChange={(e) => setColorGradient({...colorGradient, end: e.target.value})}/>
                                </div>
                            ) : (
                                <input type="color" value={color} onChange={(e) => setColor(e.target.value)}/>
                            )}
                        </div>
                    </div>
                </div>
                {slackReady && emojiName && (
                    <div
                        className={[
                            'generator-slack-meta',
                            registrationKnown && baseRegisteredUrl ? 'is-registered' : '',
                            registrationKnown && !baseRegisteredUrl ? 'is-missing' : '',
                        ].filter(Boolean).join(' ')}
                        role="status"
                    >
                        {statusThumb ? (
                            <img
                                className="generator-slack-meta__img"
                                src={statusThumb}
                                alt=""
                                draggable={false}
                            />
                        ) : (
                            <span
                                className="generator-slack-meta__placeholder"
                                style={
                                    character
                                        ? cssFontStyleForChar(character)
                                        : undefined
                                }
                                aria-hidden
                            >
                                {character}
                            </span>
                        )}
                        <code className="generator-slack-meta__name">:{emojiName}:</code>
                        <span className="generator-slack-meta__label">
                            {slack.emojiLoading || registering ? (
                                <span className="generator-slack-meta__busy">
                                    <span className="ui-spinner generator-slack-meta__spinner" aria-hidden />
                                    {registering ? '등록 중…' : '확인 중…'}
                                </span>
                            ) : slack.emojiError
                              ? '목록 실패'
                              : baseRegisteredUrl
                                ? '기본 이름 등록됨'
                                : workspaceEmoji?.registered
                                  ? '대체 이름만 있음'
                                  : '미등록'}
                        </span>
                    </div>
                )}
                <div className="generator-actions">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                            setRegisterError(null)
                            setRegisterOk(false)
                            setDownloaded(false)
                            onReset()
                        }}
                        title="글자·색·위치를 기본값으로 되돌립니다"
                    >
                        초기화
                    </button>
                    {slackReady && (
                        <button
                            type="button"
                            className={registerOk ? 'is-success' : undefined}
                            disabled={!canRegister}
                            onClick={() => void handleRegister()}
                        >
                            {registering ? (
                                <>
                                    <span className="ui-spinner generator-action-spinner" aria-hidden />
                                    등록 중…
                                </>
                            ) : registerOk
                              ? '등록됨'
                              : baseRegisteredUrl
                                ? '이미 등록됨'
                                : 'Slack에 등록'}
                        </button>
                    )}
                    <button
                        type="button"
                        className={downloaded ? 'is-success' : undefined}
                        onClick={handleDownload}
                    >
                        {downloaded ? '다운로드됨' : '이미지 다운로드'}
                    </button>
                </div>
                {registerError && (
                    <p className="generator-register-error" role="alert">
                        {registerError}
                    </p>
                )}
            </div>
        </>
    )
}

export default CharIconGenerator
