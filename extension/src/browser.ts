/**
 * Chrome exposes `chrome`; Firefox prefers `browser` (promise-based) and often
 * also provides a callback-compatible `chrome` shim — pick whatever exists.
 */
export function getExtApi(): typeof chrome {
    const g = globalThis as typeof globalThis & {
        chrome?: typeof chrome
        browser?: typeof chrome
    }
    const api = g.chrome?.runtime ? g.chrome : g.browser
    if (!api?.runtime) {
        throw new Error('extension runtime API not available')
    }
    return api
}

/** Unified sendMessage: supports promise (Firefox browser.*) and callback (chrome.*). */
export function runtimeSendMessage<T>(message: unknown): Promise<T> {
    const {runtime} = getExtApi()
    try {
        const maybePromise = runtime.sendMessage(message) as Promise<T> | undefined
        if (maybePromise && typeof (maybePromise as Promise<T>).then === 'function') {
            return maybePromise
        }
    } catch {
        /* fall through to callback form */
    }

    return new Promise<T>((resolve, reject) => {
        runtime.sendMessage(message, (response: T) => {
            const err = runtime.lastError
            if (err) {
                reject(new Error(err.message))
                return
            }
            resolve(response)
        })
    })
}
