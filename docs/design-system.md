# ZecTix Design System

Design tokens, conventions, and guidelines for ZecTix UI.

---

## Philosophy

- **Light-first.** Clean, bright, approachable — like Signal or ProtonMail, not "crypto dark mode."
- **Functional, not flashy.** Organizers need a tool that works. The UI should get out of the way.
- **Honest, not exclusive.** Open source, community-first, straightforward copy.
- **Privacy is baked in.** The privacy comes from Zcash, not from the design being dark or edgy.

---

## Tokens

All design tokens live in `:root` in `globals.css`. Use `var(--token-name)` in CSS.

### Accent (amber/gold — from the Z logo)

| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#d4920a` | Primary accent |
| `--accent-hover` | `#e8a025` | Hover state |
| `--accent-bright` | `#ffcb45` | Bright variant (badges on dark surfaces) |
| `--accent-warm` | `#f7931a` | Warm end of gradient |
| `--accent-text` | `#ca5d00` | Text labels, eyebrows |
| `--accent-subtle` | `rgba(212, 146, 10, 0.12)` | Background tints |
| `--accent-glow` | `rgba(247, 147, 26, 0.24)` | Box shadows |
| `--accent-border` | `rgba(212, 146, 10, 0.28)` | Active borders |

### Surfaces

| Token | Value | Usage |
|-------|-------|-------|
| `--surface-page` | `#fafaf9` | Page background |
| `--surface-card` | `#ffffff` | Card/panel backgrounds |
| `--surface-card-glass` | `rgba(255,255,255,0.88)` | Glass morphism cards (ops/checkout) |
| `--surface-dark` | `#131b2d` | Dark surfaces (hero, footer if needed) |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border-light` | `rgba(17, 24, 39, 0.08)` | Default card/section borders |
| `--border-medium` | `rgba(17, 24, 39, 0.12)` | Hover states, input borders |
| `--border-dark` | `rgba(255, 255, 255, 0.08)` | Borders on dark backgrounds |

### Typography colors

| Token | Value | Usage |
|-------|-------|-------|
| `--text-dark` | `#131b2d` | Headlines, primary text |
| `--text-body` | `#475569` | Body text, descriptions |
| `--text-muted` | `#64748b` | Secondary labels, hints |

### Semantic colors

| Token | Value | Usage |
|-------|-------|-------|
| `--success` / `--success-bg` | `#166534` / green tint | Confirmed, checked-in |
| `--danger` / `--danger-bg` | `#991b1b` / red tint | Errors, expired |
| `--warning` / `--warning-bg` | `#92400e` / yellow tint | Pending states |
| `--info` / `--info-bg` | `#1d4ed8` / blue tint | Informational |

### Spacing

| Token | Value |
|-------|-------|
| `--space-1` | `0.25rem` (4px) |
| `--space-2` | `0.5rem` (8px) |
| `--space-3` | `0.75rem` (12px) |
| `--space-4` | `1rem` (16px) |
| `--space-5` | `1.5rem` (24px) |
| `--space-6` | `2rem` (32px) |
| `--space-7` | `3rem` (48px) |
| `--space-8` | `4rem` (64px) |
| `--space-section` | `5rem` (80px) |

### Radii

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `8px` | Small chips, inline badges |
| `--radius-md` | `14px` | Inputs |
| `--radius-lg` | `18px` | Cards, panels |
| `--radius-xl` | `22px` | Landing page cards |
| `--radius-2xl` | `24px` | Marketing cards |
| `--radius-3xl` | `28px` | Hero cards |
| `--radius-full` | `999px` | Pills, buttons |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 18px 40px rgba(15,23,42,0.07)` | Default card shadow |
| `--shadow-card-inset` | `inset 0 1px 0 rgba(255,255,255,0.65)` | Inner highlight |
| `--shadow-elevated` | `0 30px 70px rgba(15,23,42,0.08)` | Elevated elements |

---

## Typography

| Role | Font | Weight |
|------|------|--------|
| Display / headlines | Space Grotesk (`var(--font-display)`) | 700 |
| Body | Inter | 400–600 |
| Mono (addresses, codes) | `ui-monospace` system stack | 400 |

Headlines use negative letter-spacing (`-0.03em` to `-0.04em`).

---

## Color rules

- **Amber accent is for labels and small highlights only** — section eyebrows, step numbers, active nav indicators. Never for large buttons or hero backgrounds.
- **Primary buttons use dark background** (`--surface-dark`) — not amber. This keeps the page clean and lets the content lead.
- **No pink.** The original pink gradient CTAs have been replaced. Don't reintroduce them.
- **Semantic colors are for state only** — success green for confirmed, danger red for errors, warning yellow for pending. Don't use them decoratively.

---

## CSS architecture

- **Landing page:** `landing-*` namespace in `globals.css`
- **Checkout pages:** `checkout-*` namespace
- **Ops console:** `console-*` namespace
- **Marketing (legacy):** `home-*`, `marketing-*` — these are from the original homepage and may be cleaned up over time.

New styles should use the `landing-*` pattern: scoped, flat, token-based. Avoid deep nesting.

---

## Component conventions

No formal component library yet. When building new React components:

1. Use semantic HTML elements (`<section>`, `<nav>`, `<article>`)
2. Style with CSS classes from `globals.css`, not inline styles
3. Reference design tokens via CSS custom properties
4. Keep components small — one responsibility per file
5. Use the existing class naming convention: `{namespace}-{element}` (e.g., `landing-hero`, `console-kpi-card`)
