# Charicon for Slack (browser extension)

Chrome / Firefox MV3 extension. Talks to the Charicon web app via CustomEvents + `chrome.runtime` messaging. Uses the browser’s Slack login session (no backend).

## Develop

```bash
# from repo root
npm run extension:install
npm run extension:build
# or
npm run extension:watch
```

Load unpacked / temporary add-on from `extension/dist` (see root README).

## Layout

- `src/background` — Slack I/O + message router
- `src/content` — page bridge (`data-charicon-app-id`)
- `../shared/protocol.ts` — event names & payloads (shared with web)
