# Work Order: Visual Styling & Dual-Navigation Upgrade for `devcapsule.mycodespace.ai` and `mycodespace.ai`

Date: 2026-11-12. Issued by the product owner and recorded directly in
`devcapsule-website` for execution on branch
`website-retro-blueprint-styling-and-dual-nav`. Executed in the
`devcapsule-website` repository, `single-stream`, tracked in
[CURRENT-STATUS.md](../../CURRENT-STATUS.md). It preserves
[the content–website contract](../../CONTRACT.md) without change: no authored
product prose is copied into this repository, and all existing URL routes,
aliases, canonical links, social metadata, JSON-LD, and promotion invariants
remain intact.

Status: in progress (2026-11-12). Target release: `v0.3.x` Website &
Documentation Design System Refresh; the website publishes on its own candidate
and promotion clock ([PUBLISHING.md](../../PUBLISHING.md)).

## 1. Context & Strategic Objective

We are refreshing the visual styling and layout architecture of
`devcapsule.mycodespace.ai` and establishing a shared open-source CSS foundation
that can be reused directly on `mycodespace.ai`. The design combines two
MIT-licensed reference systems:

1. **Course / Documentation Pages on `aiengineeringfromscratch.com` (`rohitg00/ai-engineering-from-scratch`, MIT License):**
   - **Aesthetic:** Aerated, low-contrast warm paper/blueprint surface
     (`#fafaf5`) with a subtle `20px × 20px` radial dot grid.
   - **Typography:** Retro-technical display headings (`Space Mono` with
     `VT323` available as a toggleable token or accent display class) paired
     with a clean, legible reading body (`Inter` at `17px` / `1.65` line height)
     and crisp monospace code and metadata badges (`JetBrains Mono`).
   - **Layout:** A 3-column documentation shell (`.docs-shell`) with a **sticky
     Left Primary Navigation** (`.docs-sidebar-left`), a **centered Main Content
     Column** (`.docs-content`, `max-width: 72ch` with generous vertical
     rhythm), and a **sticky Right Secondary Navigation** (`.docs-toc-right`,
     "On this page" `h2`/`h3` scroll-spy table of contents).
2. **GitHub Organization Profile (`github.com/mycodespace-ai` — GitHub Primer Design System, MIT License):**
   - **Aesthetic:** Crisp `1px solid` container and card borders (`#d0d7de`),
     `6px` border radius, flat metadata pills and version/status badges, subtle
     hover border highlight (`#2563eb`), minimal flat elevation
     (`0 1px 2px rgba(31, 35, 40, 0.06)`), and zero heavy drop shadows.

## 2. Repository Architecture & Workflow Reconciliation

The draft specification used parent-repository paths (`website/`, `docs/`,
`./scripts/website.sh build`) and named `multiple-streams`. Within
`devcapsule-website`, those map concretely as follows:

1. **Workflow mode:** `.devcapsule/devcapsule.toml` declares `mode = "single-stream"`
   at workflow version `0.3.1`. Work is tracked in root
   [CURRENT-STATUS.md](../../CURRENT-STATUS.md) on branch
   `website-retro-blueprint-styling-and-dual-nav` and indexed in
   [index.md](../../index.md).
2. **Strict content boundary:** User-facing documentation (`docs/`), landing
   prose (`README.md`), journal entries (`engineering-docs/blog/`), and release
   notes (`engineering-docs/releases/`) live in `mycodespace-ai/devcapsule` and
   are read from `.content/` (or the parent superproject). Templates and styles
   live in `src/` here.
3. **Existing layout landmarks & colour-scheme picker compatibility:**
   - `src/pages.njk`, `src/_includes/sidebar.njk`, `src/_includes/toc.njk`, and
     `src/assets/site.js` already extract `h2`/`h3` TOC entries at build time
     and expose `.reading-layout`, `.docs-sidebar`, `.reading-main`,
     `.toc-desktop`, `.mobile-toc`, and ARIA landmarks asserted by
     `scripts/browser-check.mjs`. The new `.docs-shell`, `.docs-sidebar-left`,
     `.docs-content`, and `.docs-toc-right` classes are applied alongside those
     existing selectors and landmarks.
   - **Colour-scheme picker (W14):** Blueprint paper (`#fafaf5` + radial dot
     grid + Primer borders) becomes the `:root` default (`blueprint`, requiring
     no JavaScript and no stored `localStorage` entry). All existing selectable
     open-source palettes (`catppuccin-latte`, `catppuccin-mocha`, `system`,
     `devcapsule-day`, `devcapsule-night`, `solarized-light`, `solarized-dark`,
     `gruvbox-light`, `gruvbox-dark`, `nord`) remain available via
     `data-palette` and pass automated WCAG 2.1 AA contrast checks.
   - **Progressive-enhancement mobile navigation (`< 860px`):** When JavaScript
     is active (`html[data-js]`), `.docs-sidebar-left` collapses into an
     accessible `.docs-nav-toggle` drawer button so mobile prose starts
     immediately near the top of the viewport; when JavaScript is disabled
     (`html:not([data-js])`), the navigation list remains open and reachable.
4. **Build & verification gate:** Parent `./scripts/website.sh build` maps here
   to `npm test`, `npm run check:content`, `npm run build`, `npm run check`, and
   `npm run test:browser` (Playwright + `@axe-core/playwright` across desktop,
   tablet, and mobile viewports plus visual inspection of `.artifacts/`
   screenshots).

## 3. Scope of Work & Deliverables

### Deliverable 1: Open-Source Typography Stack & CSS Design Tokens

Update `src/_includes/base.njk`, create `src/assets/tokens-and-base.css`, and
align `src/assets/site.css` to load the SIL Open Font License stack and define
the core tokens:

1. **Font imports (`src/_includes/base.njk`):**
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=VT323&display=swap" rel="stylesheet">
   ```
   - `--font-display`: `'Space Mono', monospace` (weights `400;700`), with
     `--font-display-retro: 'VT323', monospace` available via `.retro-vt323` or
     `:root[data-display="vt323"]`.
   - `--font-body`: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
     at `1.0625rem` (`17px`) and `1.65` line height.
   - `--font-mono`: `'JetBrains Mono', monospace` (weights `400;500;700`).

2. **Core `:root` CSS variables & base surface (`src/assets/tokens-and-base.css`):**
   - Surfaces: `--bg-paper: #fafaf5`, `--bg-surface: #ffffff`,
     `--bg-subtle: #f3f4f6`, `--line-grid: rgba(26, 26, 26, 0.055)`.
   - Ink: `--ink: #1f2328`, `--ink-soft: #4a5568`, `--ink-muted: #656d76`.
   - Accent & Primer borders: `--blueprint: #2563eb`,
     `--blueprint-subtle: rgba(37, 99, 235, 0.08)`,
     `--border-default: #d0d7de`, `--border-muted: #e5e7eb`,
     `--radius-card: 6px`.
   - Base `body`: `background-color: var(--bg-paper)` with `20px × 20px`
     `radial-gradient(var(--line-grid) 1px, transparent 1px)`, `color: var(--ink)`,
     `font-family: var(--font-body)`, `font-size: 1.0625rem`, `line-height: 1.65`.
   - `h1, h2, h3, .retro-heading`: `font-family: var(--font-display)`,
     `letter-spacing: -0.01em`, `color: var(--ink)`, `line-height: 1.25`.

### Deliverable 2: 3-Column Documentation Layout (`.docs-shell`)

Upgrade `src/pages.njk`, `src/_includes/sidebar.njk`, `src/_includes/toc.njk`,
`src/assets/tokens-and-base.css`, `src/assets/site.css`, and
`src/assets/site.js`:

1. **Desktop grid (`>= 1200px`):**
   - `.docs-shell`: `display: grid; grid-template-columns: 260px minmax(0, 1fr) 220px; gap: 2.5rem; max-width: 1400px; margin: 0 auto; padding: 0 1.5rem;`.
2. **Left Primary Navigation (`.docs-sidebar-left`):**
   - Sticky (`position: sticky; top: 4rem; max-height: calc(100vh - 4rem); overflow-y: auto;`).
   - Section headers in uppercase `--font-mono` (`0.75rem`, `0.08em` letter
     spacing, `color: var(--ink-muted)`).
   - Active-page indicator: `border-left: 2px solid var(--blueprint); background: var(--blueprint-subtle);`
     with WCAG AA foreground contrast.
3. **Center Main Content Column (`.docs-content`):**
   - Constrained to `max-width: 72ch; margin: 0 auto; padding: 2.5rem 1rem 5rem;`
     with aerated vertical spacing across paragraphs, lists, tables, callouts,
     and code blocks.
4. **Right Secondary Navigation / TOC (`.docs-toc-right`):**
   - Renders `h2` and `h3` headings with `id` attributes; sticky
     (`position: sticky; top: 5rem; max-height: calc(100vh - 6rem); overflow-y: auto; font-size: 0.825rem;`).
   - Lightweight vanilla-JS `IntersectionObserver` (< 35 lines) in
     `src/assets/site.js` setting `aria-current="location"` on the active
     visible heading link.
5. **Responsive breakpoints:**
   - Below `1200px`: hide `.docs-toc-right`, collapse `.docs-shell` to 2 columns
     (Left Sidebar + Main Content), and surface the inline `<details class="mobile-toc">`
     table of contents.
   - Below `860px`: collapse `.docs-shell` to 1 column and collapse
     `.docs-sidebar-left` into `.docs-nav-toggle` when JS is active while
     preserving full no-JS link access.

### Deliverable 3: Primer-Inspired Cards, Callouts, Code Blocks & Shared Layer

1. **Cards & feature containers:** `background: var(--bg-surface)`,
   `border: 1px solid var(--border-default)`, `border-radius: var(--radius-card)`
   (`6px`), subtle hover `border-color: var(--blueprint)`, minimal flat
   elevation (`box-shadow: 0 1px 2px rgba(31, 35, 40, 0.06)`), and zero heavy
   drop shadows across landing pillars, benefit cards, demo figure, continuity
   box, journal post cards, releases strip, and doc next-steps box.
2. **Code blocks & inline code:** `--font-mono` (`JetBrains Mono`), crisp
   `1px solid var(--border-default)` frame (`6px` radius), Primer copy button,
   and WCAG AA syntax-highlighting contrast in both light and dark palettes.
3. **Metadata pills & version/status badges:** uppercase `--font-mono`
   (`font-size: 0.75rem; letter-spacing: 0.06em; padding: 0.15rem 0.5rem; border: 1px solid var(--border-default); border-radius: 999px;`).
4. **Reusable shared stylesheet for `mycodespace.ai`:** `src/assets/tokens-and-base.css`
   holds the standalone tokens, typography/surface base, 3-column shell
   primitives, and Primer card/pill/callout/code rules so `mycodespace.ai` can
   consume the same file directly.

### Deliverable 4: Build Verification, Browser Accessibility & Visual Inspection

1. Run `npm test`, `npm run check:content`, `npm run build`, and `npm run check`
   with zero broken links, missing assets, or anchor mismatches.
2. Update and run `npm run test:browser` (`scripts/browser-check.mjs`) verifying
   desktop (`1440px`, 3-column), tablet (`1024px`, 2-column), and mobile
   (`360px`, 1-column + mobile drawer toggle + no-JS fallback), zero horizontal
   overflow, and zero automated WCAG 2A / 2AA / 2.1AA violations across every
   route and selectable colour scheme.
3. Visually inspect the rendered screenshots in `.artifacts/` and record the
   outcome and evidence in [CURRENT-STATUS.md](../../CURRENT-STATUS.md).

## 4. Sequence of Slices, With What "Done" Means

1. **Work order registration.** Commit this work order, index it in `index.md`,
   and record its start in `CURRENT-STATUS.md`.
2. **Shared tokens, typography, and Primer component system (`tokens-and-base.css` + `site.css` + `base.njk`).**
   Load Google Fonts, make Blueprint paper the `:root` default while keeping all
   W14 colour schemes functional, and apply Primer geometry across header, hero,
   cards, callouts, tables, pills, code blocks, and footer.
3. **3-column documentation shell & responsive dual navigation (`pages.njk` + `sidebar.njk` + `site.js` + `site.css`).**
   Deliver `.docs-shell`, sticky `.docs-sidebar-left`, `72ch` `.docs-content`,
   sticky scroll-spy `.docs-toc-right`, `< 1200px` 2-column collapse, and
   `< 860px` progressive-enhancement mobile drawer.
4. **Full gate, Playwright WCAG/viewport checks & visual inspection.**
   Verify all unit, contract, build, link, and browser checks (`1440px`,
   `1024px`, `360px`), inspect `.artifacts/` screenshots, and update
   `CURRENT-STATUS.md`.
