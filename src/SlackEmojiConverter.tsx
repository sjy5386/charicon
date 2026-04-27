import * as React from 'react'
import {useState} from 'react'
import {colorForChar, hangulToSlackEmoji} from './charicon.ts'

export interface SlackEmojiConverterProps {
    text: string;
    setText: React.Dispatch<React.SetStateAction<string>>;
}

const SlackEmojiConverter = ({text, setText}: SlackEmojiConverterProps) => {
    const [copied, setCopied] = useState(false)

    const result = hangulToSlackEmoji(text)

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
                        const code = ch.charCodeAt(0)
                        const isHangul = code >= 0xAC00 && code <= 0xD7A3
                        if (!isHangul) {
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
