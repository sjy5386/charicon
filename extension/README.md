# Charicon for Slack (browser extension)

Chrome / Firefox MV3 extension. Talks to the Charicon web app via CustomEvents + `chrome.runtime` messaging. Uses the browser’s Slack login session (no backend).

## Develop

```bash
# from repo root
npm run extension:install
npm run extension:build        # dev manifest (localhost + github.io)
npm run extension:watch
```

Load unpacked / temporary add-on from `extension/dist` (see root README).

## Production / store package

```bash
npm run extension:icons        # placeholder PNGs if missing
npm run extension:build:prod   # no localhost host permissions
npm run extension:zip          # → extension/release/charicon-extension-<ver>-prod.zip
```

Optional: pin a single web origin (instead of `https://*.github.io/*`):

```bash
CHARICON_WEB_ORIGIN=https://you.github.io/charicon npm run extension:zip
```

## Manifest split

| File | Role |
|------|------|
| `manifest.base.json` | Shared MV3 fields, icons, permissions |
| `manifest.dev.json` | localhost + github.io matches |
| `manifest.prod.json` | github.io + Slack only (store-oriented) |

Build merges `base` + `dev|prod` and writes `dist/manifest.json`.

## Icons

See `icons/README.md`. Slots: 16 / 32 / 48 / 128 PNG.

## Layout

- `src/background` — Slack I/O + message router
- `src/content` — page bridge (`data-charicon-app-id`)
- `../shared/protocol.ts` — event names & payloads (shared with web)
