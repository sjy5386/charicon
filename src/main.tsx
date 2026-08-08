import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import {CHARICON_APP_ID} from '@shared/protocol'
import './index.css'
import './fonts.css'
import {ensureWebFontsLoaded} from './fontFallback.ts'
import App from './App.tsx'

document.documentElement.dataset.chariconAppId = CHARICON_APP_ID

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

// Prefetch bundled webfonts so glyph probes / canvas fallback are ready early
void ensureWebFontsLoaded()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter basename={basename || undefined}>
            <App/>
        </BrowserRouter>
    </StrictMode>,
)
