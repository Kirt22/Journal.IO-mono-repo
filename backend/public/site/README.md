# Marketing site assets

Everything under `backend/public/site/` is the public marketing site. It is served by
the existing `express.static` mount in `src/app.ts` (`backend/public` → `/assets`), so
these files are reachable at `/assets/site/…`.

| File | Served at | Notes |
| --- | --- | --- |
| `index.html` | `/` | Sent by `registerLegalRoutes` via `res.sendFile` (see `LANDING_PAGE_FILE` in `src/routes/legal.routes.ts`). The host redirect for `api.` / `www.` still runs first. |
| `site.css` | `/assets/site/site.css` | The **only** stylesheet. Shared by the landing page and every legal page. |
| `site.js` | `/assets/site/site.js` | Scroll reveals, hero parallax, nav state, mobile menu, theme swatches. No dependencies. |
| `img/*.webp` | `/assets/site/img/…` | Device-framed screenshots, transparent background. |
| `img/icon-*.png`, `img/og.jpg` | | Favicons and the Open Graph card. |
| `fonts/*.woff2` | | Subset Bricolage Grotesque + Schibsted Grotesk, with their OFL licences. |

## Regenerating the binaries

The sources are gitignored local-only folders (`.gitignore` → "LOCAL SCREENSHOT WORK"),
so the generated files here are what actually ships. Rebuild them with:

```bash
./scripts/build-site-assets.sh
```

That script needs `cwebp` (`brew install webp`), `pyftsubset`
(`pip3 install fonttools brotli`), and `sips` (built into macOS). It also calls
`scripts/build-og-card.py`, which composes the 1200×630 OG card with Pillow.

Sources it reads:

- `frontend/iphone ss with frame/*_thumb.png` — the device frames
- `frontend/src/assets/fonts/*.ttf` — the brand fonts
- `frontend/ios/.../AppIcon.appiconset/Icon-App-1024x1024@1x.png` — the icons

## Editing the page

The nav and footer markup exists **twice**: in `index.html` for the landing page, and in
`renderSiteNav()` / `renderSiteFooter()` in `src/routes/legal.routes.ts` for the legal
pages. Change one, change the other — `legal.routes.test.ts` asserts the shell is present
but cannot tell you the two have drifted.

Design language follows `docs/APP_STORE_SCREENSHOT_PROMPTS.md` so the site and the App
Store listing read as one product. Copy must stay non-clinical per `AGENTS.md` §14.
