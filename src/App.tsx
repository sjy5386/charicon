import {useEffect, useRef, useState} from 'react'
import './App.css'

function App() {
    const canvasRef = useRef(null)

    const [character, setCharacter] = useState('글')
    const [backgroundColor, setBackgroundColor] = useState('black')
    const [color, setColor] = useState('white')

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // 배경 채우기
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, 100, 100);

        // 글자 쓰기
        ctx.font = "90px ChosunGs";
        ctx.fillStyle = color;
        ctx.fillText(character, 8, 80);
    })

    return (
        <>
            <div>
                <canvas ref={canvasRef} width="100" height="100"></canvas>
            </div>
            <h1>글자티콘 생성기</h1>
            <div className="card">
                <label>글자</label>
                <input type="text" maxLength={1} value={character} onChange={(e) => setCharacter(e.target.value)}/>
                <label>배경색</label>
                <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)}/>
                <label>글자색</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)}/>
            </div>
        </>
    )
}

export default App
