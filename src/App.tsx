import {useRef, useState} from 'react'
import './App.css'
import {downloadCanvas, randomColor} from './charicon.ts'
import Canvas from "./Canvas.tsx";
import Toolbar from "./Toolbar.tsx";

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

    return (
        <div className="container">
            <Toolbar font={font} setFont={setFont} fontSize={fontSize} setFontSize={setFontSize}
                     fonts={fonts}></Toolbar>

            <div className="canvas-container">
                <Canvas canvasRef={canvasRef} width={size} height={size} character={character}
                        backgroundColor={backgroundColor} color={color}
                        font={font} fontSize={fontSize} setFontSize={setFontSize}
                        x={x} setX={setX} y={y} setY={setY}></Canvas>
            </div>

            <h1>글자티콘 생성기</h1>

            <div className="card">
                <div className="input-group">
                    <div className="input-item">
                        <label>글자</label>
                        <input type="text" maxLength={1} value={character}
                               onChange={(e) => setCharacter(e.target.value)}/>
                    </div>
                    <div className="input-item">
                        <label>배경색</label>
                        <input type="color" value={backgroundColor}
                               onChange={(e) => setBackgroundColor(e.target.value)}/>
                    </div>
                    <div className="input-item">
                        <label>글자색</label>
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}/>
                    </div>
                </div>
                <button onClick={() => downloadCanvas(canvasRef.current, character + '.png')}>이미지 다운로드</button>
            </div>
        </div>
    )
}

export default App
