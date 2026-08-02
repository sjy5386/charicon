import * as esbuild from 'esbuild'
import {copyFileSync, mkdirSync, readFileSync, writeFileSync, cpSync, existsSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')
const outdir = join(__dirname, 'dist')
const sharedDir = resolve(__dirname, '../shared')

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
    },
}

function copyStatic() {
    const manifest = JSON.parse(readFileSync(join(__dirname, 'manifest.json'), 'utf8'))
    const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))
    manifest.version = pkg.version
    writeFileSync(join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

    const localesSrc = join(__dirname, '_locales')
    if (existsSync(localesSrc)) {
        cpSync(localesSrc, join(outdir, '_locales'), {recursive: true})
    }

    // Optional icons
    const iconsSrc = join(__dirname, 'icons')
    if (existsSync(iconsSrc)) {
        cpSync(iconsSrc, join(outdir, 'icons'), {recursive: true})
    }
}

async function main() {
    if (watch) {
        const ctx = await esbuild.context(options)
        await ctx.watch()
        copyStatic()
        console.log('watching extension…')
        // re-copy manifest on rebuild via plugin would be nicer; simple interval not needed —
        // user can re-run build for manifest edits.
        return
    }

    await esbuild.build(options)
    copyStatic()
    console.log('extension built → extension/dist')
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
