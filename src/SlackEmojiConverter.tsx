import * as React from 'react'
import {useEffect, useState} from 'react'
import {colorForChar, hangulToSlackEmoji, setFaviconFromCanvas} from './charicon.ts'

export interface SlackEmojiConverterProps {
    text: string;
    setText: React.Dispatch<React.SetStateAction<string>>;
}

const isHangul = (ch: string) => {
    const code = ch.charCodeAt(0)
    return code >= 0xAC00 && code <= 0xD7A3
}

/** First hangul in text (or placeholder), matching the preview order. */
const firstPreviewHangul = (text: string): string | null => {
    for (const ch of Array.from(text || '글자티콘')) {
        if (isHangul(ch)) return ch
    }
    return null
}

/** Draw the converter preview emoji style onto a canvas for the favicon. */
const drawPreviewEmojiToCanvas = (ch: string, size = 64): HTMLCanvasElement => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    const radius = size * (4 / 22)
    ctx.fillStyle = colorForChar(ch)
    ctx.beginPath()
    ctx.roundRect(0, 0, size, size, radius)
    ctx.fill()

    const fontSize = size * (14 / 22)
    ctx.fillStyle = 'white'
    ctx.font = `${fontSize}px ChosunGs, Gungsuhche, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Slight optical center for hangul in square
    ctx.fillText(ch, size / 2, size / 2 + size * 0.02)
    return canvas
}

const SlackEmojiConverter = ({text, setText}: SlackEmojiConverterProps) => {
    const [copied, setCopied] = useState(false)

    const result = hangulToSlackEmoji(text)

    useEffect(() => {
        const ch = firstPreviewHangul(text)
        if (!ch) return

        const apply = () => {
            setFaviconFromCanvas(drawPreviewEmojiToCanvas(ch))
        }

        // Wait for preview font so the favicon matches the on-page emoji
        document.fonts.load(`14px ChosunGs`).then(apply, apply)
    }, [text])

    const handleCopy = () => {
        navigator.clipboard.writeText(result).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }

    return (
        <>
            <div className="slack-preview-container">
                <div className={`slack-preview ${text ? '' : 'is-placeholder'}`}>
                    {Array.from(text || '글자티콘').map((ch, i) => {
                        if (!isHangul(ch)) {
                            return <React.Fragment key={i}>{ch}</React.Fragment>
                        }
                        return (
                            <span key={i} className="slack-preview-emoji"
                                  style={{backgroundColor: colorForChar(ch)}}>
                                {ch}
                            </span>
                        )
                    })}
                </div>
            </div>

            <h1>글자티콘 변환기</h1>
            <div className="card">
                <div className="input-group-vertical">
                    <div className="converter-field">
                        <label>입력</label>
                        <textarea rows={3} placeholder="글자티콘"
                                  value={text} onChange={(e) => setText(e.target.value)}/>
                    </div>
                    <div className="converter-arrow">↓</div>
                    <div className="converter-field">
                        <label>결과</label>
                        <textarea rows={3} readOnly placeholder=":rmf::wk::xl::zhs:"
                                  value={result}/>
                    </div>
                </div>
                <button style={{marginTop: '1.2rem'}} onClick={handleCopy} disabled={!result}>
                    {copied ? '복사됨' : '복사'}
                </button>
            </div>
        </>
    )
}

export default SlackEmojiConverter
