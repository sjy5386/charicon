import {useState} from 'react'
import './App.css'
import {randomColor} from './charicon.ts'
import {Gradient} from "./Canvas.tsx";
import CharIconGenerator from "./CharIconGenerator.tsx";
import SlackEmojiConverter from "./SlackEmojiConverter.tsx";

function App() {
    const [activeTab, setActiveTab] = useState<'generator' | 'converter'>('generator')
    const [converterText, setConverterText] = useState('')

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
            <div className="tab-bar">
                <button className={`tab ${activeTab === 'generator' ? 'active' : ''}`}
                        onClick={() => setActiveTab('generator')}>생성기
                </button>
                <button className={`tab ${activeTab === 'converter' ? 'active' : ''}`}
                        onClick={() => setActiveTab('converter')}>변환기
                </button>
            </div>

            {activeTab === 'generator' && (
                <CharIconGenerator
                    character={character} setCharacter={setCharacter}
                    bgIsGradient={bgIsGradient} setBgIsGradient={setBgIsGradient}
                    backgroundColor={backgroundColor} setBackgroundColor={setBackgroundColor}
                    bgGradient={bgGradient} setBgGradient={setBgGradient}
                    colorIsGradient={colorIsGradient} setColorIsGradient={setColorIsGradient}
                    color={color} setColor={setColor}
                    colorGradient={colorGradient} setColorGradient={setColorGradient}
                    font={font} setFont={setFont}
                    fontSize={fontSize} setFontSize={setFontSize}
                    x={x} setX={setX} y={y} setY={setY}
                />
            )}

            {activeTab === 'converter' && (
                <SlackEmojiConverter text={converterText} setText={setConverterText}/>
            )}
        </div>
    )
}

export default App
