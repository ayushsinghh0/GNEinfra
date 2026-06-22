# GNE Vendor Portal — "Soft Wave" UI/UX Redesign

**Date:** 2026-06-22
**Branch:** `vendor-only`
**Status:** Approved direction, pending spec review
**Scope:** Full visual/UX redesign of every screen. Presentation layer only — **no schema, API, or data-flow changes.**

---

## 1. Goal

Elevate the GNE Vendor Portal from a competent, clean SaaS UI to a **top-tier, "award-winning" feel** where the UI/UX is a selling point. The app is used **mostly on phones** (vendors fill KYC on-site, often in bright sunlight) and secondarily on laptops (admins). The redesign must be **premium but friendly**, **heavy-light** (bright, never dark mode), responsive, and accessible.

This is a redesign of the **`vendor-only`** branch (vendor registration only). Do not reintroduce Phase-2 modules.

## 2. Approved direction — "Soft Wave" (premium-light onboarding)

Chosen from live mockups after two rounds. The user's reference set (bright onboarding screens: colored hero + white form card, organic shapes, illustration/texture, big rounded pills) steered us from "enterprise SaaS" to **soft, illustrated, premium-light**.

**The core idea:**
- A reusable **teal "sunrise" brand hero** (gradient + soft sun-glow + ray arcs) that flows through an **organic SVG wave** into white content.
- **Warmth lives in the chrome** (heroes, headers, rails, success/empty states). **Working surfaces stay calm white** (forms, tables, data) so they're legible all day and in sunlight.
- Big **rounded** shapes, **pill** inputs/buttons, soft layered shadows, the brand teal + sparing solar amber.

The brand palette is unchanged (this is the documented "trust teal + professional blue/green" palette for this product category). We are adding **depth, atmosphere, typography confidence, and signature moments** — the four things that made the prior design read as "bland."

## 3. Design principles & guardrails

These are hard constraints (derived from the research synthesis). Every implementation task must respect them:

1. **Atmosphere only in chrome.** Aurora blobs, sun-glow, dot-grid, grain, waves, mesh gradients live ONLY in heroes/headers/rails/success/empty states — **never behind form fields, inputs, or data tables.**
2. **100% light mode.** Brand color may be a canvas in heroes; all body text, fields, and data sit on white/near-white.
3. **WCAG AA minimum.** Every fg/bg pair ≥ 4.5:1 text / 3:1 large/UI. Decorative tints capped ~15%. Placeholders ≥ `slate-500` (not 400). Verify glass-bar and status-pill labels explicitly.
4. **Never color/haptic alone.** Status and validation always pair color with an icon + text. Any haptic pairs with a visible cue (iOS Safari has no Vibration API).
5. **Ration saturation & motion.** One primary CTA per viewport; one glow/gradient-border accent per screen; overshoot spring reserved for step-advance and success only.
6. **Gate everything bleeding-edge.** All motion behind `prefers-reduced-motion`; transparency behind `prefers-reduced-transparency` with solid fallback; `linear()` easing, `animation-timeline`, `backdrop-filter`, View Transitions all wrapped in `@supports` with graceful baselines.
7. **No heavy libraries.** No Framer Motion, no chart lib, no cmdk, no confetti lib. CSS primitives + tiny (~25-line) rAF/IntersectionObserver helpers only. Grain is an inline data-URI (~1KB). Keep `backdrop-blur` off large scroll areas.
8. **Don't regress utility/a11y for delight.** Keep ≥ 44px mobile tap targets, native `<input>` under any custom dropzone, `text-base` (16px) inputs to prevent iOS zoom, `aria-live` errors/status, keyboard `:focus-visible` rings.
9. **Cross-browser safe.** Count-up must be JS rAF + IntersectionObserver (the pure-CSS `@property` counter is Chrome-only). Use `dvh` not `vh` for sticky/sheet surfaces.
10. **Migration discipline.** Presentation only — do not touch `prisma/schema.prisma` or reset the DB. Run `npm run build` (type-check) + `npm run lint` before claiming done; no test runner exists.

## 4. Design system (tokens — `src/app/globals.css`)

### 4.1 Color
Keep existing brand scale (`--color-brand-50…900`, `--color-brand`, `--color-accent` amber, `--color-canvas`). Add:
- **Semantic status tokens** derived for consistency: `approved/good → brand`, `pending/attention → amber`, `reject → rose`, `invited/neutral → slate`. One tonal family: soft `-50` bg + `-700` fg + `-600/20` inset ring.
- **Focus ring token:** `--ring-brand: color-mix(in oklab, var(--color-brand) 40%, transparent)`.

### 4.2 Elevation (the single biggest "bland" fix)
Replace flat single-layer card shadows with **layered, brand-tinted elevation** (never pure black):
```
--shadow-card:  0 0 0 1px color-mix(in oklab,#0f172a 5%,transparent),
                0 1px 2px color-mix(in oklab,#0f172a 4%,transparent),
                0 12px 24px -10px color-mix(in oklab,#0f766e 12%,transparent),
                inset 0 1px 0 rgba(255,255,255,.9);
--shadow-card-hover: /* deeper distance layer */ ;
--shadow-cta:  inset 0 1px 0 rgba(255,255,255,.2), 0 10px 22px -8px rgba(13,148,136,.6);
```
The hairline ring **is** the border (drop explicit gray borders → cleaner corners).

### 4.3 Radii
Soften globally: cards `rounded-2xl`→`rounded-3xl` for heroes/feature tiles; inputs `rounded-xl`→`rounded-2xl`; **buttons become pills** (`rounded-full`) for the primary onboarding/CTA contexts (admin utility buttons may stay `rounded-xl` for density — see §5).

### 4.4 Typography
- **Body/UI:** swap Geist → **Plus Jakarta Sans** (warmer, matches the friendly-premium direction; one-line `next/font` change).
- **Display:** add **Sora** for hero/welcome/step/success headings only (`font-[Sora]`, weight 700–800, tracking `-0.02em`).
- **Scale jump (the confident voice that was missing):** hero/step/success headings `text-3xl sm:text-4xl lg:text-5xl`; section titles ~`text-lg`; **body & form labels stay at current sizes** for density. Eyebrows: `text-[11px] uppercase tracking-[0.18em] text-brand-700 font-semibold`.
- **Tabular numerals everywhere** numeric/identifier: vendor codes, GST/PAN, bank/IFSC, phone, dates, KPIs, chart labels, counts. Add `.nums{font-variant-numeric:tabular-nums slashed-zero}`; identifiers use `--font-mono`. Right-align numeric table columns.

### 4.5 Motion
- Add spring easing tokens via `linear()` with `@supports` + cubic-bezier fallback: `--spring-snappy`, reuse existing `cubic-bezier(.16,1,.3,1)` for enter.
- Durations 150–300ms; exit ~60–70% of enter. Universal `active:scale-[.97] touch-manipulation` press feedback on tappables (use `active:`, not `hover:`, for touch).
- Extend the existing `prefers-reduced-motion` block to also disable `active:scale`, hover-lift transforms, count-up, grow-in, shimmer.

### 4.6 Atmosphere primitives (reusable, chrome-only)
Define as small components/utilities (see §6): **sun-glow** (radial amber/white blur), **blob** (blurred brand radial), **dot-grid** (masked radial-dot bg), **grain** (~5% inline-SVG feTurbulence, `mix-blend-multiply`, hidden under `prefers-reduced-transparency`), **wave** (SVG path divider).

## 5. Shared component changes — `src/components/ui.tsx`

- **`cardCls` / `Card`:** use `--shadow-card`, drop gray border, `rounded-3xl` for hero/feature cards (keep `2xl` for dense data cards). Hover → `--shadow-card-hover`.
- **`btn()` / `Button`:** primary gets steeper gradient `from-brand-500 to-brand-700` + `--shadow-cta` (inset highlight + brand ring) + spring press; **pill option** for onboarding contexts. Unify `focus-visible:ring-2 ring-brand/40 ring-offset-2 ring-offset-white`. Keep secondary/ghost/danger, refit to the new ring + press.
- **`inputCls` / `Input` / `Textarea` / `Select`:** recessed "well" (faint top gradient ≤4% + `inset 0 1px 2px`), `rounded-2xl`, keep `text-base sm:text-sm` (iOS), placeholder `slate-500`. Add valid/invalid border tints.
- **`Field`:** support a right-aligned **inline success ✓** slot; error row reveals via `grid-rows` transition + `aria-live="polite"` (no shake).
- **`Badge`:** unify to the tonal status system (already close); ensure icon+label, AA pairs.
- **`StatCard` → StatTile:** layered depth, tabular value, optional count-up, small tone chip + spark line; supports bento spans.
- **`PageHeader`:** consistent `.glass` treatment (`color-mix` white ≥78% + blur + `@supports`/reduced-transparency fallback).
- **Table helpers (`trCls`/`thCls`/`tdCls`):** row hover left brand-accent bar, reveal-on-hover "Review →" (always visible on touch via `@media (hover:none)`), sticky frosted `thead`, right-aligned numeric columns.

## 6. New shared components

- **`BrandHero`** — the reusable sunrise hero (gradient + sun-glow + ray arcs + optional wave bottom). Props: size (`lg` login / `md` wizard / `sm` dashboard header), title, eyebrow, subtitle, children. Light-only, AA text.
- **`Wave`** — SVG wave divider (white or tinted), `preserveAspectRatio="none"`.
- **`Atmosphere`** — wrapper that composes blob(s) + dot-grid + grain with the chrome-only + reduced-transparency rules baked in.
- **`SuccessCheck`** — self-drawing ring + checkmark (stroke-dashoffset, spring), reduced-motion → static; used by registration success, reupload success, and approve action.
- **`CountUp`** — ~25-line client component: IntersectionObserver + rAF ease-out, `toLocaleString('en-IN')`, reduced-motion → final value instantly.
- **`Skeleton`** — shimmer primitive (gradient sweep), reduced-motion → static block; variants mirroring StatTile/rows/fields.
- **`Dropzone`** — drag-drop file field with thumbnails (`URL.createObjectURL`, revoked), PDF glyph, per-file size + remove, progress/shimmer during compress+upload, ✓ on success. Native `<input>` hidden underneath for a11y + mobile picker. Reuses existing `validateFiles`/`compressFormImages`.

## 7. Per-screen specs

> All screens: mobile-first; desktop adaptations noted. Forms/data stay white; atmosphere in chrome only.

### 7.1 Public landing `/` (`src/app/page.tsx`)
Soft Wave card: GNE logo, "Solar EPC · Vendor Portal" pill, sunrise mini-hero or sun-glow, oversized headline, "Admin Login" pill CTA, vendor-help note, footer. Subtle atmosphere behind the card.

### 7.2 Admin login (`src/components/AdminLogin.tsx`)
**Mobile:** Soft Wave login (chosen "Take 1") — teal sunrise hero + sun-glow + ray arcs → organic wave → white form (password well, pill "Sign in", help link, AES-256/TLS trust line). **Desktop:** split-panel — atmospheric brand hero left (aurora + grain + dot-grid + oversized headline + 2–3 trust bullets + security mark), clean white form right. Error states unchanged in logic; restyled. Keep `autoFocus`, AA, `:focus-visible`.

### 7.3 Vendor wizard (`src/components/RegistrationForm.tsx`) — the workhorse
- **Header/rail:** `BrandHero` (md) with **segmented 5-step progress** + "Step N of 5 · {title}" (Sora). Wave on the header. **Mobile:** sticky frosted compact header with the segmented bar + tabular step counter. **Desktop:** the existing left **rail becomes a sunrise gradient rail** — connected **progress spine that fills** as you advance; nodes in 3 states (done = brand fill + **self-drawing checkmark**, current = ring + one-shot scale, upcoming = hairline); eyebrow+title per step; footer trust + autosave note.
- **Steps (Company / Statutory & Tax / Bank / Services / Documents):** calm white `Section` cards; fields use the new wells + **inline ✓ on valid** + non-shake error reveal. Keep all existing validation, autosave, toggles, focus management, `tf()` helper.
- **Services step:** softened repeatable rows, pill "Add another service".
- **Documents step:** replace native file inputs with **`Dropzone`** (thumbnails + per-file feedback).
- **Sticky action bar:** `.glass`, pill "Next →" / "Review & Submit", "Back" ghost, `env(safe-area-inset-bottom)` (kept), spring press, "Encrypted in transit" note.
- **Review modal:** restyle; **bottom-sheet on mobile** (grab handle, `max-h-[90dvh]`, swipe/scrim dismiss), centered card on desktop. Keep focus-trap, Esc, scroll-lock, per-section Edit.
- **Success state:** `SuccessCheck` + Sora headline + soft glow + (optional, default-off) gentle confetti. Keep `role="status"`, focus-to-heading, doc-warnings block.
- **Loading (`!ready`):** `Skeleton` of the first step instead of the spinner.
- **Terminal (expired/revoked/used):** restyle the alert card; keep `role="alert"` + focus.

### 7.4 Reupload (`src/components/ReuploadForm.tsx`)
Soft Wave card; **`Dropzone`** (single); pill "Upload"; **`SuccessCheck`** done state. Keep validation + single-use semantics.

### 7.5 Admin shell (`src/app/admin/layout.tsx`, `src/components/Sidebar.tsx`)
Honor "heavy-light": **sidebar becomes light** (white/near-white) with the GNE logo chip, teal active pill + left accent, slate idle text, "Coming soon" group. Mobile drawer + top bar restyled to match (keep Esc, route-close, `inert`, a11y). *(Alternative considered: teal-gradient rail like the wizard — defaulting to light for max "heavy-light"; flag in review if you prefer the teal rail.)*

### 7.6 Dashboard (`src/app/admin/page.tsx`, `src/components/Charts.tsx`)
- Light **mint `BrandHero` (sm)** header: greeting + "Dashboard" + avatar.
- **Bento** of KPI **StatTiles** (Total / Awaiting / Approved / Pending invites / This month) with depth, tone chips, spark lines, **CountUp**, and the existing click-through links.
- **Charts upgrade (CSS-only):** gridlines + baseline, rounded **gradient bars that grow in** (staggered), hover/focus tooltips; **StatusBars** animate width with count chips.
- `InviteForm` + recent-vendors table restyled (row affordances, sticky thead, tabular). Empty states use the branded `EmptyState`.

### 7.7 Vendors list (`src/app/admin/vendors/page.tsx`, `VendorRow.tsx`, `VendorSearch.tsx`)
Restyle search card; table with row hover accent + reveal "Review →" + sticky frosted thead + tabular GST/PAN/dates; whole-row click kept; branded empty state. Status filter chips read from the unified tonal system.

### 7.8 Vendor detail / review (`src/app/admin/vendors/[id]/page.tsx`, `VendorInfoCards.tsx`, `VendorStatusActions.tsx`)
- Identity header: company name (Sora), `Badge`, vendorCode chip (tabular), registered date; email-mismatch warning kept.
- **Review & Status** card; **approve/reject** restyled; on **approve**, optional `SuccessCheck` + vendorCode reveal. (Optimistic UI is **optional/nice** — keep server as source of truth.)
- Info cards (Company/Statutory/Bank) with tabular values, inline-edit kept (validation intact). Documents list + Services restyled; doc actions (View/Download/Request) kept. Export (Excel/PDF) buttons kept.

### 7.9 Invites (`src/app/admin/invites/page.tsx`) & Settings (`src/app/admin/settings/page.tsx`)
Inherit the system: branded headers, soft cards, pill CTAs, tabular dates, status badges, branded empty states, restyled `TestEmail`/`DeleteButton`/`DocumentRequestButton`.

### 7.10 Print page (`src/app/vendors/[id]/print/page.tsx`)
**Out of redesign scope for atmosphere** — it backs the PDF export and must stay print-clean. Only minimal token alignment (fonts/tabular) if free; no heroes/gradients/motion.

## 8. Responsive behavior
Breakpoints 375 / 768 / 1024 / 1440. Mobile-first; headings scale down one step on smallest breakpoint; no horizontal scroll; `min-h-dvh`/`dvh` for sticky/sheets; safe-area insets on fixed bars; drop atmosphere blob count on mobile for perf. Desktop adds: login split-panel, wizard sunrise rail, dashboard bento widening, optional Cmd-K (optional tier).

## 9. Accessibility (must hold)
Contrast AA verified per surface; `:focus-visible` rings app-wide; keyboard order intact; `aria-live` for errors/status/toasts; reduced-motion + reduced-transparency honored; 44px targets; native inputs under custom UI; color never sole signal; dynamic-type tolerant (no truncation-as-text-grows on key labels).

## 10. Enrichment kit — priority

**Must (foundational, ship first):** layered card elevation; tabular numerals + `.nums`; CTA inset-highlight + spring press; unified focus-ring + status tonal system; wizard rail as progress instrument w/ self-drawing checks; inline field success ✓ + non-shake errors + input wells; chrome atmosphere (sun-glow/wave/blob/dot-grid/grain); oversized display type + eyebrows; **Soft Wave login**.

**Nice (high impact, second):** CountUp KPIs; bento dashboard; frosted glass chrome; spring easing + universal press; Dropzone w/ thumbnails; self-drawing success screen; skeleton loaders; CSS data-viz upgrade; branded split-panel auth; light sidebar.

**Optional (power/polish, last):** optimistic admin actions; table reveal affordances; scroll-driven reveals; Cmd-K palette; bottom-sheet modals + haptics.

## 11. Out of scope / non-goals
No dark mode. No new features, routes, or data model changes. No Phase-2 modules. No new heavy dependencies. No backend/email/storage/auth logic changes. Print page stays print-optimized.

## 12. Verification
- `npm run build` (type-check) and `npm run lint` must pass before "done".
- Manual check at 375px + landscape; reduced-motion on; largest dynamic type; verify AA on hero text, status pills, glass bars; confirm no atmosphere bleeds behind inputs/tables; confirm iOS no-zoom (16px inputs) and safe-area insets.
- Spot-check the live deploy over HTTPS (Secure cookie / login) is unaffected.
