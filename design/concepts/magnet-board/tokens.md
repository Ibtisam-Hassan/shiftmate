# Magnet Board

**Idea:** the roster whiteboard in the back office, where a manager slides coloured magnets between names. Each shift is a solid magnet you pick up and drop; the team is grouped by role the way real boards are; a side panel says exactly what stands between you and Publish.

## Palette

| Name | Hex | Role |
|---|---|---|
| Board Green | `#1F4A3D` | top bar, light-mode primary |
| Whiteboard | `#F3F7F4` | page background (cool, faint green) |
| Aluminium | `#B9C6BF` | the 5px board frame |
| Magnet Blue / Violet / Teal / Graphite | `#2A62A8` / `#7446A8` / `#0E7478` / `#3B4048` | Cashier / Stock / Floor / Supervisor |
| Marker Amber | `#E0A100` | warnings and the draft dot |

## CSS variables

| Variable | Light | Dark |
|---|---|---|
| `--background` | `#F3F7F4` | `#0F241E` |
| `--foreground` | `#16302A` | `#E8F1EC` |
| `--card` / `--popover` | `#FFFFFF` | `#163129` |
| `--card-foreground` | `#16302A` | `#E8F1EC` |
| `--primary` | `#1F4A3D` | `#86D6AE` |
| `--primary-foreground` | `#FFFFFF` | `#0F241E` |
| `--muted` / `--secondary` | `#E6EEE9` | `#1C3A31` |
| `--muted-foreground` | `#4E6A61` | `#A5BFB3` |
| `--accent` | `#DDEFE4` | `#214539` |
| `--accent-foreground` | `#16302A` | `#E8F1EC` |
| `--border` / `--input` | `#CAD8D0` | `#2D4E43` |
| `--ring` | `#2A62A8` | `#8DB8F0` |
| `--destructive` | `#BF2630` | `#F2848A` |
| `--pos-cashier` | `#2A62A8` | `#356DB5` |
| `--pos-stock` | `#7446A8` | `#7F52B4` |
| `--pos-floor` | `#0E7478` | `#137C80` |
| `--pos-supervisor` | `#3B4048` | `#4F5560` |
| `--on-pos` (magnet text) | `#FFFFFF` | `#FFFFFF` |
| `--warning` (rings, dots) | `#E0A100` | `#F2BC3A` |
| `--warning-foreground` / `--warning-bg` | `#6B4A00` / `#FFF4D1` | `#F6CF6B` / `#3A2F0E` |
| `--danger` / `--danger-bg` | `#BF2630` / `#FCE6E7` | `#F2848A` / `#43191C` |
| `--overtime` / `--overtime-bg` | `#AE2D76` / `#F9E2EF` | `#F08AC3` / `#40182F` |
| `--sidebar` (top bar) | `#1F4A3D` | `#0A1C17` |

Magnets stay mid-dark in dark mode so white text keeps 5:1. Contrast checked by script (`../contrast.cjs`): every text pair is 4.97:1 or higher in both modes. Amber (`--warning`) is used only for non-text marks; warning *text* uses `--warning-foreground`.

## Type

- **Lexend** (300–700), one family. It was designed for reading ease, with wide letter spacing, which suits staff reading a schedule on a phone in a stockroom. Base weight 350 so the wide letterforms do not look heavy.
- Scale (px): 11 / 12 / 12.5 (magnet) / 13 (base) / 14 (day header) / 15–16 (panel titles) / 19 (labor figures) / 22 (page title) / 26 (phone "next shift").

## Radius, spacing, density

- Radius is layered on purpose: magnets and controls are fully round (999px), panels 12px, the board 10px inside a 5px aluminium frame. Shadows exist only on magnets, because a magnet sits on the board and the rest is flat.
- Density: the roomiest of the three. Rows 40px plus role-group headers. 10 employees plus the open-shift tray fit at 1440×900.
- Layout: top bar, then the board on the left and a 272px **Ready to publish?** checklist on the right. The draft notice is the board's top edge; the Publish button sits at the bottom of the checklist and stays disabled until blockers clear.

## The memorable thing

The solid magnet: a pill in the position colour with a lit top edge and a short cast shadow, which lifts 1px on hover. Open shifts are empty dashed magnet outlines in a tray row at the top of the board.

## Principles

1. A magnet's colour is its position. Text on the magnet is only the time, plus the position name only when it differs from the row's group (Tyler's Stock shift in the Cashiers group).
2. Problems are rings around a magnet (solid red = blocks, dashed amber = check) with a small pin, and each one is also written out in plain words in the checklist.
3. Publishing is a checklist, not a guess: the panel names who, what day and what to do.
4. Round for things you touch, square-ish for containers.

## Revised after self-review

- **First draft printed the position on every magnet.** It truncated ("Super…", "Cash…") and was redundant with the colour and the group header. Now it only appears when a shift is off-role, which also makes cross-role shifts stand out.
- **Rows were 44px.** With role headers only 9 people fit. Tightened to 40px; 10 now fit.
- **Worried this would read as the rounded-SaaS-card kit.** Checked: the pills are the one physical metaphor; panels are flat, with no gradients and no shadows except on magnets.
- **Draft banner lost its Publish button** to the checklist. Kept that way on purpose: Publish sits beside the reasons it is blocked.
