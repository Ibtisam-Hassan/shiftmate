# Stockroom

**Idea:** the back room of a Chicago store: kraft cardboard chrome, a white sheet on top, caution tape for "not live yet", Chicago's own typeface for the numbers, and each shift drawn as a bar on the store's day so openers and closers line up.

## Palette

| Name | Hex | Role |
|---|---|---|
| Kraft | `#C9A57A` | top bar and phone tab bar |
| Carton Brown | `#7A4B1E` | primary (Publish), budget meter |
| Box Ink | `#241C14` | text |
| Sheet | `#FFFFFF` on `#EDE3D3` | the working surface on a cardboard page |
| Caution | `#E8B400` + ink stripes | draft marker only |

This is warm, but not the cream-and-serif look: the page is a kraft tan, the working surface is pure white, there is no serif and no clay accent.

## CSS variables

| Variable | Light | Dark |
|---|---|---|
| `--background` | `#EDE3D3` | `#16110C` |
| `--foreground` | `#241C14` | `#F1E8DC` |
| `--card` / `--popover` | `#FFFFFF` | `#211A13` |
| `--card-foreground` | `#241C14` | `#F1E8DC` |
| `--primary` | `#7A4B1E` | `#E2B87F` |
| `--primary-foreground` | `#FFFFFF` | `#241C14` |
| `--muted` / `--secondary` | `#F6F0E6` | `#2A2219` |
| `--muted-foreground` | `#66563F` | `#BFAE97` |
| `--accent` | `#F3E2C2` | `#3A2D1F` |
| `--accent-foreground` | `#241C14` | `#F1E8DC` |
| `--border` / `--input` | `#DDCDB5` | `#3E3226` |
| `--ring` | `#1D5FB4` | `#7EB0F2` |
| `--destructive` | `#B3122B` | `#F27E88` |
| `--pos-cashier` | `#1D5FB4` | `#72A8F0` |
| `--pos-stock` | `#6A3FA0` | `#B394EA` |
| `--pos-floor` | `#1C7543` | `#5BC28D` |
| `--pos-supervisor` | `#3A2E22` | `#E6D9C6` |
| `--warning` / `--warning-bg` | `#855400` / `#FCEAB8` | `#F2C35A` / `#3A2B0C` |
| `--danger` / `--danger-bg` | `#B3122B` / `#FBE4E6` | `#F27E88` / `#3E1519` |
| `--overtime` / `--overtime-bg` | `#A8246A` / `#F9E1EE` | `#F283BC` / `#3C1629` |
| `--kraft` / `--kraft-foreground` | `#C9A57A` / `#241C14` | `#4A3824` / `#F4E6D2` |
| `--track` (empty day bar) | `#EFE6D8` | `#2E251B` |

Contrast checked by script (`../contrast.cjs`): text pairs 4.6:1 or higher in both modes; position bars at least 3:1 against their track.

## Type

- **Big Shoulders Display** (800): page title, day numbers, labor figures. It was drawn for the City of Chicago, so the numbers carry the stores' home town. Condensed, so big numbers cost little width.
- **Big Shoulders Stencil Display**: the wordmark only (stencilled like a shipping box).
- **Libre Franklin** (400–700): all UI text and shift times. An American gothic that stays clear at 12px.
- Scale (px): 10.5 (axis) / 11.5 / 12 / 13 (base) / 26–28 (day numbers, labor) / 34 (page title). Mobile title 40.

## Radius, spacing, density

- Radius: 3px on the sheet, 4px on bars (round ends like tape), 6px on buttons. One soft 1px "sheet on cardboard" shadow; nothing else has a shadow.
- Density: medium. Rows 46px, name column 210px, axis ticks at 6a / 12p / 6p. All 11 employees plus the open-shift row fit at 1440×900.
- Top bar navigation with store tabs (Downtown / Riverside / Oak Park) in plain view: there are only three stores, so no dropdown.

## The memorable thing

Every shift is a bar placed on a 6a–11p track inside its day cell, with faint noon and 6p guides running down each column. You can see who opens and who closes without reading a single time, and a double-booking shows as two bars overlapping in the same span.

## Principles

1. Position in time is information: the bar goes where the shift is in the day.
2. Warmth lives in the chrome (kraft, stencil), never on the working surface. The grid is white.
3. Stripes mean "check this" (caution tape on the draft banner, striped bars for warnings). Red outline means "this blocks publishing".
4. Big Shoulders only for numbers people scan from a distance; everything read up close is Libre Franklin.

## Revised after self-review

- **Considered a Chicago transit ('L' line) theme** with shift bars as train lines. Kept only the underlying idea (time as a track) and dropped the transit branding: it would imitate a real agency's identity and mixes metaphors with a retail back room.
- **The first draft had a cream page.** It moved toward the generic warm-cream look, so the page became a darker kraft tan and the working surface pure white.
- **Status notes had their own line**, which made Tyler's conflict row 105px tall and pushed rows off screen. Notes now replace the position label on the same line ("✕ Conflict", "! Unavailable", "! Short rest"), with the full reason in the tooltip. Rows went from 54 to 46px and all 11 people now fit.
- **Rows aligned to the bottom** of their cell; single shifts in a tall conflict row looked lost. Now centred.
- Still open: at 1280px the warning words truncate ("! Unavaila…"). The striped bar still says "check", but a real build should drop the word to an icon under about 130px per day.
