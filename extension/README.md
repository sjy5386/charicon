# Charicon for Slack (browser extension)

Chrome / Firefox MV3 extension. Talks to the Charicon web app via CustomEvents + `chrome.runtime` messaging. Uses the browser’s Slack login session (no backend).

## Develop

```bash
# from repo root
npm run extension:install
npm run extension:build        # dev (localhost + web origin)
npm run extension:watch
```

Load unpacked / temporary add-on from `extension/dist` (see root README).

## Web origin (required at build time)

No hard-coded site URL in the build script. You **must** provide an origin or the build exits:

1. `CHARICON_WEB_ORIGIN` env (highest priority)
2. `extension/config.json` → `webOrigin`

```bash
cp extension/config.example.json extension/config.json
# edit webOrigin, then:
npm run extension:build:prod

# or one-off without config file:
CHARICON_WEB_ORIGIN=https://your.domain.example npm run extension:zip
```


## Production / store package

```bash
npm run extension:icons        # if icons missing
npm run extension:build:prod   # web origin + Slack only
npm run extension:zip          # → extension/release/charicon-extension-<ver>-prod.zip
```

## Manifest split

| File | Role |
|------|------|
| `config.json` | Default web origin for inject |
| `manifest.base.json` | Shared MV3 fields, icons, permissions |
| `manifest.dev.json` | localhost (+ inject adds web origin) |
| `manifest.prod.json` | Slack only (+ inject adds web origin) |

Build merges `base` + `dev|prod`, injects web origin, writes `dist/manifest.json`.

## Icons

See `icons/README.md`. Slots: 16 / 32 / 48 / 128 PNG.

## Layout

- `src/background` — Slack I/O + message router
- `src/content` — page bridge (`data-charicon-app-id`)
- `../shared/protocol.ts` — event names & payloads (shared with web)
