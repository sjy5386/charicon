/**
 * Extension icons matching the generator canvas look:
 * black background, white "글" in ChosunGs (조선궁서체), centered.
 *
 * Font: downloads ChosunGs.woff (same CDN as the web app) into extension/fonts/
 * if missing, then rasterizes with @napi-rs/canvas.
 */
import {createCanvas, GlobalFonts} from '@napi-rs/canvas'
import {existsSync, mkdirSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fontsDir = join(__dirname, '../fonts')
const outDir = join(__dirname, '../icons')
const fontPath = join(fontsDir, 'ChosunGs.woff')
const FONT_URL =
    'https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_20-04@1.0/ChosunGs.woff'

/**
 * Match generator defaults from urlState.defaultGeneratorState (100×100 canvas):
 *   character: '글', background ~ black for icons, color: white,
 *   font: ChosunGs, fontSize: 90, x: 8, y: 80, textBaseline: alphabetic
 */
const CHAR = '글'
const BG = '#010101'
const FG = '#ffffff'
const SIZES = [16, 32, 48, 128]
const REF = 100
const REF_FONT = 90
const REF_X = 8
const REF_Y = 80

async function ensureFont() {
    if (existsSync(fontPath)) return
    mkdirSync(fontsDir, {recursive: true})
    console.log('downloading ChosunGs.woff…')
    const res = await fetch(FONT_URL)
    if (!res.ok) throw new Error(`font download failed: ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(fontPath, buf)
    console.log('saved', fontPath)
}

function drawIcon(size) {
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')
    const scale = size / REF

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, size, size)

    const fontSize = REF_FONT * scale
    const x = REF_X * scale
    const y = REF_Y * scale
    ctx.font = `${fontSize}px ChosunGs`
    ctx.fillStyle = FG
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(CHAR, x, y)

    return canvas.toBuffer('image/png')
}

await ensureFont()
const registered = GlobalFonts.registerFromPath(fontPath, 'ChosunGs')
if (!registered) {
    console.warn('warning: font register returned empty key; continuing')
}

mkdirSync(outDir, {recursive: true})
for (const size of SIZES) {
    const path = join(outDir, `icon${size}.png`)
    const png = drawIcon(size)
    writeFileSync(path, png)
    console.log('wrote', path, `(${png.length} bytes)`)
}
