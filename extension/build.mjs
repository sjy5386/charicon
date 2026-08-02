import * as esbuild from 'esbuild'
import {execFileSync} from 'node:child_process'
import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')
const zip = process.argv.includes('--zip')
const prod = process.argv.includes('--prod')
const mode = prod ? 'prod' : 'dev'
const outdir = join(__dirname, 'dist')
const sharedDir = resolve(__dirname, '../shared')
const releaseDir = join(__dirname, 'release')

mkdirSync(outdir, {recursive: true})

/** @type {import('esbuild').BuildOptions} */
const options = {
    entryPoints: {
        background: join(__dirname, 'src/background/index.ts'),
        content: join(__dirname, 'src/content/index.ts'),
    },
    bundle: true,
    outdir,
    format: 'iife',
    platform: 'browser',
    target: ['chrome109', 'firefox109'],
    logLevel: 'info',
    alias: {
        '@shared': sharedDir,
    },
    define: {
        __EXT_VERSION__: JSON.stringify(
            JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')).version,
        ),
        __EXT_MODE__: JSON.stringify(mode),
    },
}

function deepMerge(base, overlay) {
    if (Array.isArray(overlay)) return overlay.slice()
    if (overlay && typeof overlay === 'object') {
        const out = {...base}
        for (const [k, v] of Object.entries(overlay)) {
            if (
                v &&
                typeof v === 'object' &&
                !Array.isArray(v) &&
                base?.[k] &&
                typeof base[k] === 'object' &&
                !Array.isArray(base[k])
            ) {
                out[k] = deepMerge(base[k], v)
            } else {
                out[k] = deepMerge(undefined, v)
            }
        }
        return out
    }
    return overlay
}

function ensureIcons() {
    const required = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png']
    const iconsDir = join(__dirname, 'icons')
    const missing = required.some((f) => !existsSync(join(iconsDir, f)))
    if (!missing) return
    const placeholder = join(__dirname, 'scripts/generate-placeholder-icons.mjs')
    console.log('icons missing — generating generator-style “글” icons…')
    execFileSync(process.execPath, [placeholder], {stdio: 'inherit'})
}

function buildManifest() {
    const base = JSON.parse(readFileSync(join(__dirname, 'manifest.base.json'), 'utf8'))
    const overlayPath = join(__dirname, `manifest.${mode}.json`)
    const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'))
    const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))
    const manifest = deepMerge(base, overlay)
    manifest.version = pkg.version
    // Optional: pin a single origin for store builds
    // CHARICON_WEB_ORIGIN=https://you.github.io/charicon
    const origin = process.env.CHARICON_WEB_ORIGIN?.replace(/\/$/, '')
    if (mode === 'prod' && origin) {
        const pattern = `${origin}/*`
        for (const cs of manifest.content_scripts ?? []) {
            cs.matches = [pattern]
        }
        manifest.host_permissions = [
            pattern,
            ...(manifest.host_permissions ?? []).filter(
                (p) => p.includes('slack.com'),
            ),
        ]
    }
    return manifest
}

function copyStatic() {
    ensureIcons()
    const manifest = buildManifest()
    writeFileSync(join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

    const localesSrc = join(__dirname, '_locales')
    if (existsSync(localesSrc)) {
        cpSync(localesSrc, join(outdir, '_locales'), {recursive: true})
    }

    const iconsSrc = join(__dirname, 'icons')
    const iconsOut = join(outdir, 'icons')
    if (existsSync(iconsOut)) rmSync(iconsOut, {recursive: true})
    mkdirSync(iconsOut, {recursive: true})
    for (const size of [16, 32, 48, 128]) {
        const name = `icon${size}.png`
        cpSync(join(iconsSrc, name), join(iconsOut, name))
    }
}

function zipDist() {
    const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))
    mkdirSync(releaseDir, {recursive: true})
    const zipName = `charicon-extension-${pkg.version}-${mode}.zip`
    const zipPath = join(releaseDir, zipName)
    if (existsSync(zipPath)) rmSync(zipPath)

    // Store-relative paths from dist root (no parent folder in zip)
    try {
        execFileSync('zip', ['-r', '-X', zipPath, '.'], {
            cwd: outdir,
            stdio: 'inherit',
        })
    } catch {
        console.error(
            'zip failed — install `zip` CLI, or package extension/dist manually.',
        )
        process.exit(1)
    }
    console.log(`zipped → extension/release/${zipName}`)
}

async function main() {
    if (watch) {
        if (prod) {
            console.warn('note: --watch uses the selected mode once at start:', mode)
        }
        const ctx = await esbuild.context(options)
        await ctx.watch()
        copyStatic()
        console.log(`watching extension (${mode})…`)
        return
    }

    await esbuild.build(options)
    copyStatic()
    console.log(`extension built → extension/dist  [mode=${mode}]`)
    if (zip) zipDist()
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
