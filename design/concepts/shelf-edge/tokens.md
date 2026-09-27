# Shelf Edge

**Idea:** the schedule reads like the shelf-edge price strip in the store itself: navy fixture, price-tag yellow for the thing that needs your hand, and shift times set in wide, heavy numerals the way prices are.

## Palette

| Name | Hex | Role |
|---|---|---|
| Fixture Navy | `#14213D` | ink, rail, light-mode primary |
| Aisle | `#F2F5F8` | page background (cool, blue-grey) |
| Tag Yellow | `#FFC61A` | Publish, draft marker, active nav, dark-mode primary |
| Shelf Steel | `#CBD4DF` | borders and rules |
| Clearance Red | `#C42B2B` | blocking conflicts only |

## CSS variables (shadcn names + ShiftMate extras)

| Variable | Light | Dark |
|---|---|---|
| `--background` | `#F2F5F8` | `#0C1424` |
| `--foreground` | `#14213D` | `#E6ECF5` |
| `--card` / `--popover` | `#FFFFFF` | `#131F36` |
| `--card-foreground` | `#14213D` | `#E6ECF5` |
| `--primary` | `#14213D` | `#FFC61A` |
| `--primary-foreground` | `#FFFFFF` | `#14213D` |
| `--muted` / `--secondary` | `#E4E9F0` | `#1A2843` |
| `--muted-foreground` | `#4A5A73` | `#9EADC7` |
| `--accent` | `#FFC61A` | `#FFC61A` |
| `--accent-foreground` | `#14213D` | `#14213D` |
| `--border` / `--input` | `#CBD4DF` | `#2A3B5E` |
| `--ring` | `#2563C9` | `#7FA8F7` |
| `--destructive` | `#C42B2B` | `#F47272` |
| `--pos-cashier` | `#2563C9` | `#74A3F7` |
| `--pos-stock` | `#7C4DDB` | `#AD8CF4` |
| `--pos-floor` | `#0B8566` | `#3CC79E` |
| `--pos-supervisor` | `#3B4A66` | `#A9B8D6` |
| `--warning` / `--warning-bg` | `#9A5B00` / `#FFF1CC` | `#F4B63F` / `#3A2A0A` |
| `--danger` / `--danger-bg` | `#C42B2B` / `#FDE6E6` | `#F47272` / `#3D1519` |
| `--overtime` / `--overtime-bg` | `#B0206F` / `#FBE3F0` | `#F27CC0` / `#3A1530` |
| `--sidebar` | `#14213D` | `#08101E` |

Shift blocks are `color-mix(position 11%, card)` in light and 20% in dark, with a 4px position rail. Contrast was checked by script (`../contrast.cjs`): every text pair is 4.7:1 or higher in both modes.

## Type

- **Archivo** (variable, `wdth` 62–125, `wght` 400–800), one family for everything.
- Names and body at normal width. Times, day numbers, money and hours at `wdth` 115–125, weight 750: the wide price-tag numeral. The `a`/`p` suffix drops to about 75% size so `9a–5p` scans as two numbers.
- Tabular figures everywhere.
- Scale (px): 11 / 11.5 / 13 (base) / 13.5 (shift time) / 16 (day number) / 22 (page title, labor figures).

## Radius, spacing, density

- Radius: 2px on shift blocks (they are tags, not cards), 4px on buttons and panels, 6px on the store switcher. No shadows except the 2px "pressed tag" edge under Publish.
- Density: the tightest of the three. Rows 50px, cells padded 4px, name column 196px. 10 employee rows plus the open-shift row fit at 1440×900. Rows with a flagged shift grow to three lines.
- Left rail (208px, navy) for navigation. Grid fills the rest.

## The memorable thing

The wide, heavy shift numerals (`12p–8p`) with a coloured rail, like shelf price labels. Yellow is spent only on the things that need a manager's action: Publish, the draft strip, the active nav item and badges.

## Principles

1. Yellow means "your move". Never decorative.
2. Numbers are the product: every time, hour and dollar gets the wide numeral treatment; words stay quiet.
3. Position is a rail and a tint, never a full fill, so status outlines (red solid = blocks, amber = check) always read on top.
4. Sharp corners for things that are data, soft corners only for controls.

## Revised after self-review

- **First plan used a condensed face for times.** I moved it to the stockroom concept (Big Shoulders) and made this one *wide*, so the three concepts do not share a typographic voice. Wide numerals are also closer to how price tags are actually set.
- **First draft put flag text ("Double-booked") on the same line as the position.** It overflowed the cell at 1440 and badly at 1280. Flags now sit on their own line with short words (Double-booked, Overlap, Unavailable, Short rest); the full reason is in the tooltip.
- **Publish was greyed out while blockers existed.** A disabled yellow button looked broken and wasted the one accent. It is now always live and opens a publish checklist; the draft strip lists what blocks it.
- **"Approve overtime"** wrapped at 1280 and became "Approve OT".
- Considered a punched hole on each shift tag for the price-tag look. Cut it: decoration on 50+ blocks is noise.
