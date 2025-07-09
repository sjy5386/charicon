import * as React from 'react'
import {useEffect, useState} from 'react'
import './fonts.css'

export interface CanvasProps {
    canvasRef: React.MutableRefObject<HTMLCanvasElement | null>
    width: number;
    height: number;
    character: string;
    backgroundColor: string;
    color: string;
    font: string;
    fontSize: number;
    x: number;
    setX: React.Dispatch<React.SetStateAction<number>>;
    y: number;
    setY: React.Dispatch<React.SetStateAction<number>>;
}

const Canvas = ({
                    canvasRef,
                    width,
                    height,
                    character,
                    backgroundColor,
                    color,
                    font,
                    fontSize,
                    x,
                    setX,
                    y,
                    setY,
                }:
                CanvasProps
    ) => {
        const [dragging, setDragging] = useState(false);
        const [dragStart, setDragStart] = useState({x: 0, y: 0});

        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) {
                throw new Error('Canvas not found');
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Canvas context must be null');
            }

            // 배경 채우기
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, 100, 100);

            // 글자 쓰기
            document.fonts.load(`${fontSize}px ${font}`).then(() => {
                ctx.font = `${fontSize}px ${font}`;
                ctx.fillStyle = color;
                ctx.fillText(character, x, y);
            });
        })

        return (
            <>
                <canvas ref={canvasRef} width={width} height={height} onMouseDown={e => {
                    setDragging(true);
                    setDragStart({x: e.nativeEvent.offsetX - x, y: e.nativeEvent.offsetY - y});
                }} onMouseMove={e => {
                    if (!dragging) {
                        return;
                    }
                    setX(e.nativeEvent.offsetX - dragStart.x);
                    setY(e.nativeEvent.offsetY - dragStart.y);
                }} onMouseUp={() => setDragging(false)} onMouseLeave={() => setDragging(false)}
                        style={{'cursor': 'grab'}}></canvas>
            </>
        );
    }
;

export default Canvas;
