import {Gradient} from './Canvas.tsx'
import {randomColor} from './charicon.ts'

export type Route = 'generator' | 'converter'

export interface GeneratorState {
    character: string
    bgIsGradient: boolean
    backgroundColor: string
    bgGradient: Gradient
    colorIsGradient: boolean
    color: string
    colorGradient: Gradient
    font: string
    fontSize: number
    x: number
    y: number
}

export interface AppUrlState extends GeneratorState {
    route: Route
    converterText: string
}

const parseNumber = (value: string | null, fallback: number): number => {
    if (value === null || value === '') return fallback
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

const paramsFromSearch = (search: string): URLSearchParams =>
    new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

export const defaultGeneratorState = (): GeneratorState => ({
    character: '글',
    bgIsGradient: false,
    backgroundColor: randomColor(),
    bgGradient: {start: '#ffffff', end: '#000000'},
    colorIsGradient: false,
    color: 'white',
    colorGradient: {start: '#ffffff', end: '#000000'},
    font: 'ChosunGs',
    fontSize: 90,
    x: 8,
    y: 80,
})

export const defaultAppState = (route: Route = 'generator'): AppUrlState => ({
    route,
    converterText: '',
    ...defaultGeneratorState(),
})

export const routeFromPathname = (pathname: string): Route =>
    pathname.endsWith('/converter') || pathname === 'converter' ? 'converter' : 'generator'

export const readGeneratorQuery = (search: string, fallback?: GeneratorState): GeneratorState => {
    const p = paramsFromSearch(search)
    const base = fallback ?? defaultGeneratorState()
    const bg = p.get('bg')
    const bgStart = p.get('bgStart')
    const bgEnd = p.get('bgEnd')
    const colorParam = p.get('color')
    const colorStart = p.get('colorStart')
    const colorEnd = p.get('colorEnd')
    const char = p.get('char')
    const hasGeneratorParams =
        p.has('char') || p.has('bg') || p.has('bgGrad') || p.has('bgStart') || p.has('bgEnd') ||
        p.has('color') || p.has('colorGrad') || p.has('colorStart') || p.has('colorEnd') ||
        p.has('font') || p.has('size') || p.has('x') || p.has('y')

    if (!hasGeneratorParams && fallback) {
        return fallback
    }

    return {
        character: char && char.length > 0 ? [...char][0] : base.character,
        bgIsGradient: p.has('bgGrad') ? p.get('bgGrad') === '1' : base.bgIsGradient,
        backgroundColor: bg ?? bgStart ?? base.backgroundColor,
        bgGradient: {
            start: bgStart ?? bg ?? base.bgGradient.start,
            end: bgEnd ?? base.bgGradient.end,
        },
        colorIsGradient: p.has('colorGrad') ? p.get('colorGrad') === '1' : base.colorIsGradient,
        color: colorParam ?? colorStart ?? base.color,
        colorGradient: {
            start: colorStart ?? colorParam ?? base.colorGradient.start,
            end: colorEnd ?? base.colorGradient.end,
        },
        font: p.get('font') ?? base.font,
        fontSize: parseNumber(p.get('size'), base.fontSize),
        x: parseNumber(p.get('x'), base.x),
        y: parseNumber(p.get('y'), base.y),
    }
}

export const readConverterQuery = (search: string, fallbackText = ''): string => {
    const p = paramsFromSearch(search)
    if (!p.has('text')) return fallbackText
    return p.get('text') ?? ''
}

/** Merge location into state; other tab's fields stay from `prev`. */
export const applyLocationToState = (
    prev: AppUrlState | undefined,
    pathname: string,
    search: string,
): AppUrlState => {
    const route = routeFromPathname(pathname)
    const base = prev ?? defaultAppState(route)

    if (route === 'converter') {
        return {
            ...base,
            route,
            converterText: readConverterQuery(search, base.converterText),
        }
    }

    return {
        ...base,
        route,
        ...readGeneratorQuery(search, base),
        converterText: base.converterText,
    }
}

/** Current-tab query params only. */
export const stateToSearchParams = (state: AppUrlState): URLSearchParams => {
    const p = new URLSearchParams()

    if (state.route === 'converter') {
        if (state.converterText) {
            p.set('text', state.converterText)
        }
        return p
    }

    if (state.character) {
        p.set('char', state.character)
    }

    if (state.bgIsGradient) {
        p.set('bgGrad', '1')
        p.set('bgStart', state.bgGradient.start)
        p.set('bgEnd', state.bgGradient.end)
    } else {
        p.set('bg', state.backgroundColor)
    }

    if (state.colorIsGradient) {
        p.set('colorGrad', '1')
        p.set('colorStart', state.colorGradient.start)
        p.set('colorEnd', state.colorGradient.end)
    } else {
        p.set('color', state.color)
    }

    p.set('font', state.font)
    p.set('size', String(state.fontSize))
    p.set('x', String(state.x))
    p.set('y', String(state.y))

    return p
}

export const pathForRoute = (route: Route): string =>
    route === 'converter' ? '/converter' : '/generator'

export const searchStringForState = (state: AppUrlState): string => {
    const query = stateToSearchParams(state).toString()
    return query ? `?${query}` : ''
}
