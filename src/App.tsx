import {useRef, useState} from 'react'
import './App.css'
import {downloadCanvas, randomColor} from './charicon.ts'
import Canvas, {Gradient} from "./Canvas.tsx";
import Toolbar from "./Toolbar.tsx";

function App() {
    const canvasRef = useRef(null)

    const size = 100
    const fonts = ['ChosunGs', 'Gungsuhche', '궁서체'];

    const [character, setCharacter] = useState('글')

    const [bgIsGradient, setBgIsGradient] = useState(false)
    const [backgroundColor, setBackgroundColor] = useState(randomColor())
    const [bgGradient, setBgGradient] = useState<Gradient>({start: '#ffffff', end: '#000000'})

    const [colorIsGradient, setColorIsGradient] = useState(false)
    const [color, setColor] = useState('white')
    const [colorGradient, setColorGradient] = useState<Gradient>({start: '#ffffff', end: '#000000'})

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
                        backgroundColor={bgIsGradient ? bgGradient : backgroundColor}
                        color={colorIsGradient ? colorGradient : color}
                        font={font} fontSize={fontSize} setFontSize={setFontSize}
                        x={x} setX={setX} y={y} setY={setY}></Canvas>
            </div>

            <h1>글자티콘 생성기</h1>

            <div className="card">
                <div className="input-group-vertical">
                    <div className="input-item main-input">
                        <label>글자</label>
                        <input type="text" maxLength={1} value={character}
                               onChange={(e) => setCharacter(e.target.value)}/>
                    </div>
                    <div className="input-row">
                        <div className="input-item">
                            <label>배경색</label>
                            <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
                                <input type="checkbox" checked={bgIsGradient}
                                       onChange={(e) => setBgIsGradient(e.target.checked)}/>
                                <span style={{fontSize: '12px'}}>그라데이션</span>
                            </div>
                            {bgIsGradient ? (
                                <div style={{display: 'flex', gap: '4px'}}>
                                    <input type="color" value={bgGradient.start}
                                           onChange={(e) => setBgGradient({...bgGradient, start: e.target.value})}/>
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
                            <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
                                <input type="checkbox" checked={colorIsGradient}
                                       onChange={(e) => setColorIsGradient(e.target.checked)}/>
                                <span style={{fontSize: '12px'}}>그라데이션</span>
                            </div>
                            {colorIsGradient ? (
                                <div style={{display: 'flex', gap: '4px'}}>
                                    <input type="color" value={colorGradient.start}
                                           onChange={(e) => setColorGradient({
                                               ...colorGradient,
                                               start: e.target.value
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
                <button style={{marginTop: '1.2rem'}}
                        onClick={() => downloadCanvas(canvasRef.current, character + '.png')}>이미지 다운로드
                </button>
            </div>
        </div>
    )
}

export default App
