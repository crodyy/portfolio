# AGENTS.md — portfolio (static site)

Vanilla HTML/CSS/JS portfolio. No framework, no build step, no dependencies.
Files: `index.html`, `projects.html`, `gallery.html`, `404.html`, `styles.css`,
`script.js` (shared by all pages, every module self-guards for missing elements),
`photos/`, `cursors/` (license at `cursors/LICENSE-bibata.txt`). Git repo with
`origin https://github.com/crodyy/portfolio.git` (branch `main`); `CNAME`
holds the custom domain (`crod.in`, GitHub Pages) — keep it.

## Run & verify

- Serve: `python -m http.server 5173` with workdir `C:\portfolio`.
- Background servers/jobs die between turns — always start the server AND run
  the check in a SINGLE bash call (`Start-Process ... -PassThru`, test, then
  `Stop-Process`). Verify with `Invoke-WebRequest ... | Select StatusCode`.
- Headless verification: `node` + `puppeteer-core` (installed in temp dir) driving
  Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
  Reusable scripts live in `C:\Users\nilam\AppData\Local\Temp\opencode\verify\`
  (navspec, fan-check, theme-check, burger768, row-check, etc.).
- After any CSS/JS change, bust caches: stylesheet/script tags carry `?v=N`
  (currently `?v=3`) — bump on every shipped change or browsers serve stale files.

## Shell quoting traps (PowerShell)

- NEVER `node -e "..."` with `$(` inside double quotes (pwsh eats it as a
  subexpression) — write temp scripts via the write tool instead.
- NEVER `python -c` with nested quotes — same fix.
- Prefer the `edit` tool over `sed`-style rewriting; `read` a file at least once
  before editing it; same-file edits must be sequential, never parallel.

## Site conventions (user-enforced, do not "improve")

- All visible text lowercase (CSS `text-transform`); uppercase micro-labels only
  via explicit classes. No emojis (user overrides allowed).
- Fonts: Geist + Geist Mono via Google Fonts link (same URL on all 4 pages).
  One 1080px `.container`; left edges shared; spacing scale 4/8/16/24/40/64/120.
- Dark-first with `[data-theme="light"]` token overrides; default (no attr) is dark.
  Inline head snippet applies stored/OS theme pre-paint — duplicated per page.
- Colors: white text, single ice-blue accent `#9eddf7` (dark) / `#0369a1` (light);
  gold `#e8b84d` (1st) and bronze `#c98f5f` (3rd) achievement badges stay constant.
- Cursors: custom Bibata PNGs (`cursors/`, GPL-3.0, see LICENSE-bibata.txt) with
  `.cur` fallbacks; screenshots never capture the OS cursor — verify via
  computed style, never screenshots.

## Gotchas learned the hard way

- Project grid caches `sessionStorage` 30 min: bump `CACHE_KEY` (`crodyy-repos-vN`)
  whenever project data shape/content changes, or tabs render stale cards.
- `backdrop-filter` on an ancestor makes it the containing block for fixed
  descendants (broke the slide-in menu sizing once).
- Equal-specificity CSS: later rules win — the end-of-file unified font-size rule
  silently beats same-specificity component rules (bit us on panel links).
- Headless screenshots render tiny icons ambiguously — zoom (deviceScaleFactor 3
  clip) before judging glyphs.
- Headless mouse starts off-page: hover tests need explicit `mouse.move`; scroll
  tests must disable smooth scrolling or account for it.
- `overflow-x: clip` on `html` (with `hidden` fallback) is load-bearing: the
  off-canvas mobile menu otherwise leaks `scrollWidth` site-wide on phones.
- PNGs screenshotted in headless Edge flatten transparency — key out backgrounds
  explicitly when rasterizing assets.
- `python -m http.server` serves everything as 200 including `404.html`
  (real hosts map it automatically); favicon is an inline `data:` URI.
