import * as React from 'react'
import {useRef} from 'react'
import {downloadCanvas, hangulToQwerty} from './charicon.ts'
import Canvas, {Gradient} from "./Canvas.tsx"

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
    font: string;
    setFont: React.Dispatch<React.SetStateAction<string>>;
    fontSize: number;
    setFontSize: React.Dispatch<React.SetStateAction<number>>;
    x: number;
    setX: React.Dispatch<React.SetStateAction<number>>;
    y: number;
    setY: React.Dispatch<React.SetStateAction<number>>;
}

const CharIconGenerator = ({
                               character, setCharacter,
                               bgIsGradient, setBgIsGradient,
                               backgroundColor, setBackgroundColor,
                               bgGradient, setBgGradient,
                               colorIsGradient, setColorIsGradient,
                               color, setColor,
                               colorGradient, setColorGradient,
                               font, setFont,
                               fontSize, setFontSize,
                               x, setX, y, setY,
                           }: CharIconGeneratorProps) => {
    const canvasRef = useRef(null)
    const size = 100
    const fonts = ['ChosunGs', 'Gungsuhche', '궁서체']

    return (
        <>
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
                                       onChange={(e) => {
                                           const checked = e.target.checked;
                                           setBgIsGradient(checked);
                                           if (checked) {
                                               setBgGradient(prev => ({...prev, start: backgroundColor}));
                                           }
                                       }}/>
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
                                       onChange={(e) => {
                                           const checked = e.target.checked;
                                           setColorIsGradient(checked);
                                           if (checked) {
                                               setColorGradient(prev => ({...prev, start: color}));
                                           }
                                       }}/>
                                <span style={{fontSize: '12px'}}>그라데이션</span>
                            </div>
                            {colorIsGradient ? (
                                <div style={{display: 'flex', gap: '4px'}}>
                                    <input type="color" value={colorGradient.start}
                                           onChange={(e) => setColorGradient({...colorGradient, start: e.target.value})}/>
                                    <input type="color" value={colorGradient.end}
                                           onChange={(e) => setColorGradient({...colorGradient, end: e.target.value})}/>
                                </div>
                            ) : (
                                <input type="color" value={color} onChange={(e) => setColor(e.target.value)}/>
                            )}
                        </div>
                    </div>
                    <div className="input-row">
                        <div className="input-item">
                            <label>글꼴</label>
                            <select value={font} onChange={(e) => setFont(e.target.value)}>
                                {fonts.map((f, index) => (
                                    <option key={index} value={f}>{f}</option>
                                ))}
                            </select>
                        </div>
                        <div className="input-item">
                            <label>크기</label>
                            <input type="number" value={fontSize}
                                   onChange={(e) => setFontSize(Number(e.target.value))}
                                   min={0} max={200}/>
                        </div>
                    </div>
                </div>
                <button style={{marginTop: '1.2rem'}}
                        onClick={() => downloadCanvas(canvasRef.current, hangulToQwerty(character) + '.png')}>이미지
                    다운로드
                </button>
            </div>
        </>
    )
}

export default CharIconGenerator
