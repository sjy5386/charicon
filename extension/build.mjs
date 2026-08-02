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

function resolveWebOrigin() {
    // 1) CHARICON_WEB_ORIGIN  2) extension/config.json → webOrigin
    // No hardcoded default: missing value fails the build.
    const fromEnv = process.env.CHARICON_WEB_ORIGIN?.trim()
    if (fromEnv) {
        return normalizeWebOrigin(fromEnv)
    }

    const configPath = join(__dirname, 'config.json')
    if (existsSync(configPath)) {
        try {
            const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
            if (cfg.webOrigin != null && String(cfg.webOrigin).trim() !== '') {
                return normalizeWebOrigin(String(cfg.webOrigin))
            }
        } catch (e) {
            console.error('Failed to read extension/config.json:', e)
            process.exit(1)
        }
    }

    console.error(`
Missing web app origin for the extension build.

Set one of:
  1) CHARICON_WEB_ORIGIN=https://your.domain.example
  2) extension/config.json  →  { "webOrigin": "https://your.domain.example" }

  cp extension/config.example.json extension/config.json
  # edit webOrigin, then:
  npm run extension:build:prod
`)
    process.exit(1)
}

function normalizeWebOrigin(raw) {
    const origin = raw.trim().replace(/\/$/, '')
    if (!/^https?:\/\/[^/\s]+$/i.test(origin)) {
        console.error(
            `Invalid web origin "${raw}". Use an origin only, e.g. https://your.domain.example (no path).`,
        )
        process.exit(1)
    }
    return origin
}

function injectWebOrigin(manifest) {
    const origin = resolveWebOrigin()
    const pattern = `${origin}/*`
    const scripts = manifest.content_scripts ?? []
    for (const cs of scripts) {
        const matches = new Set(cs.matches ?? [])
        matches.add(pattern)
        // Drop empty placeholders from prod overlay
        cs.matches = [...matches].filter(Boolean)
    }
    const hosts = new Set(manifest.host_permissions ?? [])
    hosts.add(pattern)
    manifest.host_permissions = [...hosts]
    return {manifest, origin, pattern}
}

function buildManifest() {
    const base = JSON.parse(readFileSync(join(__dirname, 'manifest.base.json'), 'utf8'))
    const overlayPath = join(__dirname, `manifest.${mode}.json`)
    const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'))
    const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))
    let manifest = deepMerge(base, overlay)
    manifest.version = pkg.version
    // Web app origin is always injected at build time (not hard-coded in prod overlay)
    const {manifest: next, origin} = injectWebOrigin(manifest)
    manifest = next
    console.log(`web origin → ${origin}  [mode=${mode}]`)
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
