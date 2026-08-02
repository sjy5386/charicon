# Extension icons

Required PNG files (used by `manifest` `icons` / `action.default_icon`):

| File | Size |
|------|------|
| `icon16.png` | 16×16 |
| `icon32.png` | 32×32 |
| `icon48.png` | 48×48 |
| `icon128.png` | 128×128 |

## Generation (generator canvas style)

Same layout as generator defaults (100×100 → fontSize 90, x 8, y 80, alphabetic baseline):
black background (`#010101`), white **글**, **ChosunGs**:

```bash
# from repo root
npm run extension:icons
```

Downloads `ChosunGs.woff` into `extension/fonts/` (gitignored) on first run.
