import * as React from 'react'
import {useEffect} from 'react'
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
    y: number;
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
                    y,
                }: CanvasProps) => {
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
        ctx.font = `${fontSize}px ${font}`;
        ctx.fillStyle = color;
        ctx.fillText(character, x, y);
    })

    return (
        <>
            <canvas ref={canvasRef} width={width} height={height}></canvas>
        </>
    );
};

export default Canvas;
