import {useEffect, useRef, useState} from 'react'
import './App.css'
import {randomColor, downloadCanvas} from './charicon.ts'

function App() {
    const canvasRef = useRef(null)

    const size = 100
    const fonts = ['ChosunGs', 'Gungsuhche', '궁서체'];

    const [character, setCharacter] = useState('글')
    const [backgroundColor, setBackgroundColor] = useState(randomColor())
    const [color, setColor] = useState('white')

    const [font, setFont] = useState('ChosunGs')
    const [fontSize, setFontSize] = useState(90)
    const [x, setX] = useState(8)
    const [y, setY] = useState(80)

    useEffect(() => {
        const canvas = canvasRef.current;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const ctx = canvas.getContext('2d');

        // 배경 채우기
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, 100, 100);

        // 글자 쓰기
        ctx.font = `${fontSize}px ${font}`;
        ctx.fillStyle = color;
        ctx.fillText(character, x, y);
    })

    return (
        <>
            <div>
                <canvas ref={canvasRef} width={size} height={size}></canvas>
            </div>
            <h1>글자티콘 생성기</h1>
            <div className="card">
                <div>
                    <label>글자</label>
                    <input type="text" maxLength={1} value={character} onChange={(e) => setCharacter(e.target.value)}/>
                    <label>배경색</label>
                    <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)}/>
                    <label>글자색</label>
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)}/>
                </div>
                <div>
                    <label>글꼴</label>
                    <select value={font} onChange={(e) => setFont(e.target.value)}>
                        {fonts.map((font, index) => (
                            <option key={index} value={font}>
                                {font}
                            </option>
                        ))}
                    </select>
                    <label>크기</label>
                    <input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                           min={0} max={size}/>
                    <label>X</label>
                    <input type="range" value={x} onChange={(e) => setX(Number(e.target.value))}
                           max={size} min={-size} id="x-range-input"/>
                    <label>Y</label>
                    <input type="range" value={y} onChange={(e) => setY(Number(e.target.value))}
                           max={size * 2} min={-size / 2} id="y-range-input"/>
                </div>
                <button onClick={() => downloadCanvas(canvasRef.current, character + '.png')}>다운로드</button>
            </div>
        </>
    )
}

export default App
