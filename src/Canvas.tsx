import * as React from 'react'
import {useEffect, useState} from 'react'
import './fonts.css'

export interface Gradient {
    start: string;
    end: string;
}

export interface CanvasProps {
    canvasRef: React.MutableRefObject<HTMLCanvasElement | null>
    width: number;
    height: number;
    character: string;
    backgroundColor: string | Gradient;
    color: string | Gradient;
    font: string;
    fontSize: number;
    setFontSize: React.Dispatch<React.SetStateAction<number>>;
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
                    setFontSize,
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

            const getFillStyle = (fill: string | Gradient, w: number, h: number) => {
                if (typeof fill === 'string') {
                    return fill;
                }
                const gradient = ctx.createLinearGradient(0, 0, w, h);
                gradient.addColorStop(0, fill.start);
                gradient.addColorStop(1, fill.end);
                return gradient;
            };

            // 배경 채우기
            ctx.fillStyle = getFillStyle(backgroundColor, width, height);
            ctx.fillRect(0, 0, width, height);

            // 글자 쓰기
            document.fonts.load(`${fontSize}px ${font}`).then(() => {
                ctx.font = `${fontSize}px ${font}`;
                ctx.fillStyle = getFillStyle(color, width, height);
                ctx.textBaseline = 'alphabetic'; // 베이스라인 명시
                ctx.fillText(character, x, y);
            });
        })

        return (
            <>
                <canvas ref={canvasRef} width={width} height={height} onMouseDown={e => {
                    e.preventDefault();
                    setDragging(true);
                    setDragStart({x: e.nativeEvent.offsetX - x, y: e.nativeEvent.offsetY - y});
                }} onMouseMove={e => {
                    if (!dragging) {
                        return;
                    }
                    e.preventDefault();
                    setX(e.nativeEvent.offsetX - dragStart.x);
                    setY(e.nativeEvent.offsetY - dragStart.y);
                }} onMouseUp={() => setDragging(false)} onMouseLeave={() => setDragging(false)} onTouchStart={e => {
                    e.preventDefault();
                    setDragging(true);
                    setDragStart({x: e.touches[0].clientX - x, y: e.touches[0].clientY - y});
                }} onTouchMove={e => {
                    if (!dragging) {
                        return;
                    }
                    e.preventDefault();
                    setX(e.nativeEvent.touches[0].clientX - dragStart.x);
                    setY(e.nativeEvent.touches[0].clientY - dragStart.y);
                }} onTouchEnd={() => setDragging(false)} onWheel={e => {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        setFontSize(prevState => Math.max(0, Math.min(prevState + e.deltaY * -0.1, 200)));
                    }
                }}
                        style={{'cursor': 'grab'}}></canvas>
            </>
        );
    }
;

export default Canvas;
