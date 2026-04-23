import * as React from 'react'
import {useState} from 'react'
import {hangulToSlackEmoji} from './charicon.ts'

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
