import {useEffect, useState, type SetStateAction} from 'react'
import {
    Navigate,
    NavigationType,
    NavLink,
    Outlet,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useNavigationType,
    useOutletContext,
} from 'react-router-dom'
import './App.css'
import CharIconGenerator from './CharIconGenerator.tsx'
import SlackEmojiConverter from './SlackEmojiConverter.tsx'
import {
    applyLocationToState,
    pathForRoute,
    searchStringForState,
    type AppUrlState,
    type Route as AppRoute,
} from './urlState.ts'

const PAGE_TITLES: Record<AppRoute, string> = {
    generator: '글자티콘 생성기',
    converter: '글자티콘 변환기',
}

type AppOutletContext = {
    state: AppUrlState
    setField: <K extends keyof AppUrlState>(key: K) => (value: SetStateAction<AppUrlState[K]>) => void
}

function useOutletApp() {
    return useOutletContext<AppOutletContext>()
}

function AppLayout() {
    const location = useLocation()
    const navigate = useNavigate()
    const navigationType = useNavigationType()

    const [state, setState] = useState<AppUrlState>(() =>
        applyLocationToState(undefined, location.pathname, location.search),
    )

    useEffect(() => {
        document.title = PAGE_TITLES[state.route]
    }, [state.route])

    // Browser back/forward only: merge current route query; keep the other tab in memory.
    useEffect(() => {
        if (navigationType !== NavigationType.Pop) return
        setState(prev => applyLocationToState(prev, location.pathname, location.search))
    }, [location.pathname, location.search, navigationType])

    // Push query updates from state (replace so typing doesn't flood history).
    useEffect(() => {
        const nextPath = pathForRoute(state.route)
        const nextSearch = searchStringForState(state)
        const currentSearch = location.search || ''
        if (location.pathname === nextPath && currentSearch === nextSearch) return

        navigate(
            {pathname: nextPath, search: nextSearch},
            {replace: true},
        )
    }, [state, location.pathname, location.search, navigate])

    const setField = <K extends keyof AppUrlState>(key: K) =>
        (value: SetStateAction<AppUrlState[K]>) => {
            setState(prev => ({
                ...prev,
                [key]: typeof value === 'function'
                    ? (value as (prev: AppUrlState[K]) => AppUrlState[K])(prev[key])
                    : value,
            }))
        }

    const goTo = (route: AppRoute) => {
        if (state.route === route) return
        const next = {...state, route}
        setState(next)
        navigate(
            {pathname: pathForRoute(route), search: searchStringForState(next)},
            {replace: false},
        )
    }

    return (
        <div className="container">
            <div className="tab-bar">
                <NavLink
                    to={{
                        pathname: pathForRoute('generator'),
                        search: searchStringForState({...state, route: 'generator'}),
                    }}
                    className={({isActive}) => `tab ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                        e.preventDefault()
                        goTo('generator')
                    }}
                >
                    생성기
                </NavLink>
                <NavLink
                    to={{
                        pathname: pathForRoute('converter'),
                        search: searchStringForState({...state, route: 'converter'}),
                    }}
                    className={({isActive}) => `tab ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                        e.preventDefault()
                        goTo('converter')
                    }}
                >
                    변환기
                </NavLink>
            </div>

            <Outlet context={{state, setField} satisfies AppOutletContext}/>
        </div>
    )
}

function GeneratorPage() {
    const {state, setField} = useOutletApp()

    return (
        <CharIconGenerator
            character={state.character} setCharacter={setField('character')}
            bgIsGradient={state.bgIsGradient} setBgIsGradient={setField('bgIsGradient')}
            backgroundColor={state.backgroundColor} setBackgroundColor={setField('backgroundColor')}
            bgGradient={state.bgGradient} setBgGradient={setField('bgGradient')}
            colorIsGradient={state.colorIsGradient} setColorIsGradient={setField('colorIsGradient')}
            color={state.color} setColor={setField('color')}
            colorGradient={state.colorGradient} setColorGradient={setField('colorGradient')}
            font={state.font} setFont={setField('font')}
            fontSize={state.fontSize} setFontSize={setField('fontSize')}
            x={state.x} setX={setField('x')} y={state.y} setY={setField('y')}
        />
    )
}

function ConverterPage() {
    const {state, setField} = useOutletApp()
    return <SlackEmojiConverter text={state.converterText} setText={setField('converterText')}/>
}

function App() {
    return (
        <Routes>
            <Route path="/" element={<AppLayout/>}>
                <Route index element={<Navigate to="generator" replace/>}/>
                <Route path="generator" element={<GeneratorPage/>}/>
                <Route path="converter" element={<ConverterPage/>}/>
                <Route path="*" element={<Navigate to="generator" replace/>}/>
            </Route>
        </Routes>
    )
}

export default App
