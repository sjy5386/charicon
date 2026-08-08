import * as React from 'react'
import {useEffect, useState} from 'react'
import {setFaviconFromCanvas} from './charicon.ts'
import {
    ensureWebFontsLoaded,
    fillTextWithFontFallback,
    resolveFaceForChar,
} from './fontFallback.ts'
import './fonts.css'

/**
 * When font-size changes with left/alphabetic anchoring, shift (x, y) so the
 * glyph's optical center stays put instead of collapsing toward bottom-left.
 */
const positionPreservingFontSizeChange = (
    ctx: CanvasRenderingContext2D | null,
    character: string,
    oldSize: number,
    newSize: number,
    x: number,
    y: number,
): {x: number; y: number} => {
    if (oldSize <= 0 || newSize === oldSize) {
        return {x, y}
    }
    const ratio = newSize / oldSize

    // Default em offsets when metrics are unavailable (typical CJK box).
    let offsetX = oldSize * 0.5
    let offsetY = -oldSize * 0.36

    if (ctx && character) {
        const face = resolveFaceForChar(Array.from(character)[0] ?? character)
        const drawn = oldSize * face.scale
        ctx.font = `${drawn}px "${face.family}"`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        const m = ctx.measureText(character)
        const left = m.actualBoundingBoxLeft ?? 0
        const right = m.actualBoundingBoxRight ?? m.width
        const ascent = m.actualBoundingBoxAscent ?? drawn * 0.8
        const descent = m.actualBoundingBoxDescent ?? drawn * 0.2
        // Ink box relative to left/alphabetic anchor (x, y).
        offsetX = (right - left) / 2
        offsetY = (descent - ascent) / 2
    }

    return {
        x: x + offsetX * (1 - ratio),
        y: y + offsetY * (1 - ratio),
    }
}

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

            let cancelled = false;

            // 배경 채우기
            ctx.fillStyle = getFillStyle(backgroundColor, width, height);
            ctx.fillRect(0, 0, width, height);

            // 글자 쓰기 (ChosunGs → 글리프 없으면 Gungsuhche)
            void ensureWebFontsLoaded(fontSize).then(() => {
                if (cancelled) return;
                // 배경 다시 칠한 뒤 글자 (비동기 레이스 방지)
                ctx.fillStyle = getFillStyle(backgroundColor, width, height);
                ctx.fillRect(0, 0, width, height);
                ctx.fillStyle = getFillStyle(color, width, height);
                ctx.textBaseline = 'alphabetic';
                ctx.textAlign = 'left';
                fillTextWithFontFallback(ctx, character, x, y, fontSize);
                setFaviconFromCanvas(canvas);
            });

            return () => {
                cancelled = true;
            };
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
                        const nextSize = Math.max(0, Math.min(fontSize + e.deltaY * -0.1, 200));
                        if (nextSize === fontSize) {
                            return;
                        }
                        const canvas = canvasRef.current;
                        const ctx = canvas?.getContext('2d') ?? null;
                        const nextPos = positionPreservingFontSizeChange(
                            ctx, character, fontSize, nextSize, x, y,
                        );
                        setX(nextPos.x);
                        setY(nextPos.y);
                        setFontSize(nextSize);
                    }
                }}
                        style={{'cursor': 'grab'}}></canvas>
            </>
        );
    }
;

export default Canvas;
