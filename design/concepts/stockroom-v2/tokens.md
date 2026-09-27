# Stockroom v2: changes from v1 and new component specs

The design system is unchanged: same palette and CSS variables (light and dark), Big Shoulders Display, Big Shoulders Stencil and Libre Franklin, kraft chrome with a white sheet, time-track bars, caution stripes meaning "check", and a red outline meaning "blocks publishing". See `../stockroom/tokens.md` for the base. **No new hex values.** Every new surface is a `color-mix()` of existing tokens.

## Token changes

| Change | Value | Why |
|---|---|---|
| none to base variables | — | v1 variables copied as they were |
| drop-ok tint (derived) | `color-mix(--ring 9%, --card)` + inset `--ring` 55% | "free to drop here" reuses the focus/selection hue, not a position hue |
| drop-over tint (derived) | `color-mix(--ring 16%, --card)` + 2px `--ring` | the target under the cursor |
| drop-no (derived) | 45° hatch of `--muted` / `--card` | pattern, not colour, marks invalid |
| OT zone on meters (derived) | `color-mix(--overtime 16%, --track)` | shows where 40 h ends before anyone crosses it |
| coverage bar (derived) | `color-mix(--muted-foreground 45%, --card)` | quiet by default; only gaps get colour |

Contrast: `node design/concepts/stockroom-v2/contrast.cjs` checks 32 pairs per mode (text 4.5:1, icons, rings and bars 3:1). All pass. Lowest text pair: 5.45 (light) and 5.73 (dark). The coverage bars are held only to 1.5:1 on purpose: they are ambient, and a gap never depends on them (it is hatched, outlined in red and labelled).

## Type changes

- **Narrow cells use compact times** (`12–8` instead of `12:00–8:00`). The full time is in the tooltip, the popover and `aria-label`.
- Big Shoulders is now also used for popover titles (`1:00–7:00`), the rail heading, the rank numbers in Assign, and the phone hero (64px).

## Status rendering rule (fixes v1's truncation)

Each bar sits in a size container (`container-type: inline-size` on the cell), so the label adapts to the cell's own width, not the window's:

| Cell width | Time | Right side, normal | Right side, flagged |
|---|---|---|---|
| ≥ 176px | `12:00–8:00` | full position ("Supervisor") | icon + word ("✕ Double-booked") |
| < 176px | `12–8` | short position ("Sup", "Cash") | icon only |

176px is measured, not guessed: it is the widest pair ("10:00–10:00" + "✕ Double-booked") plus padding. **Status never relies on colour alone.** Blocking is a round ✕ icon, a red-outlined bar and a red cell. Warning is a triangle ! icon and a striped bar. Kept-anyway is an outlined ✓. The full reason is always in the tooltip, the `aria-label`, the popover and the rail.

## New components

### Review rail ("Ready to publish?")
- 300px (272px under 1360px) on the right of the sheet, sticky, scrolls on its own. It collapses to a 48px vertical tab showing the blocker count (the `›` button, or `?rail=closed`).
- Sections in this order: **Blocks publishing** (double-bookings, unapproved overtime), **Check before publishing** (availability, short rest, coverage gaps), **Open shifts**, **Kept anyway** (with the reason).
- Each item has a 4px left edge (red for blocks, amber for check, overtime colour for OT, dashed for open), an icon, a plain-language title and detail. Clicking the text scrolls to the cell and gives it a 2px ring that pulses twice (static under reduced motion), then moves focus to it.
- Each item has one or two fix actions, primary action first. They are computed, not canned: "Move Tyler's 1:00–7:00 to Omar" uses the top Assign candidate; "Extend Omar to 9:00 (32 → 33 h)" picks whoever ends at the gap with the fewest hours. "Keep anyway…" opens an inline reason field.
- Publish lives in the sheet header and stays **disabled while blockers remain**, with the reason beside it ("Can't publish yet: fix 1 double-booking and approve Jordan's overtime."). Warnings never block. All copy says staff are notified **in the app**. No texts or emails anywhere.

### Shift popover
- 330px card with an 8px radius and one shadow. Anchored beside the clicked bar, which gets a selection ring.
- Content: time (Big Shoulders 26px), person and day; the shift on its day track with a notch at the break; position; break ("30 min unpaid, around 4:00"; shifts of 6 h or more); paid hours and cost; that person's week meter; notes; this shift's problems in a red or amber box; actions **Edit** (primary), **Reassign…**, **Make open**, **Delete** (danger, pushed right).
- Employees get **Request a swap** on their own shift (see mobile). Managers don't; they reassign.

### Assign / Reassign panel
- 400px, same shell as the popover. Title "Assign 10:00–6:00" plus position, day, hours and the ranking rule, stated.
- Up to 4 ranked candidates. Rank order: added overtime, then short-rest risk, then already working that day, then added cost. Each shows: trained or primary role, free all day or already working, "no overtime" or "+6 h overtime" (overtime colour), short-rest warning, a before-to-after hours meter, and the added cost. The first row is tinted, and its Assign is the primary button.
- "Not suggested:" lists everyone else with the reason (unavailable Sundays, working 11:00–5:00, not trained on Cashier, time off).
- Footer: "Offer to everyone qualified" (an in-app notice).

### Hours meter (name column, popover, Assign)
- 6px track from 0 to 48 h. The 40 h tick is a 1.5px `--foreground` line. The zone beyond 40 h is tinted with the overtime colour even when empty. The fill is `--foreground` up to 40 and `--overtime` beyond. The number sits on the right; it turns overtime colour over 40, and "OT ok" appears once overtime is approved.
- The overtime row keeps v1's 3px overtime inset on the name cell.

### Coverage strip (under the day headers)
- A 17-column histogram per day (6a–11p, one column per hour, 18px tall, height = headcount out of 6).
- Hours outside store hours (Mon–Sat 9a–9p, Sun 10a–6p) use `--track`. Store hours below the minimum (2) become a full-height red hatch with a red outline, and the tick row is replaced by "▨ 8p–9p". Each column has a tooltip ("8p: 1 person, below minimum").
- This is the payoff of the time-track: coverage is the same axis as the bars directly below it.

### Drag states
- **Hover or focus:** a `⋮⋮` grip appears at the bar's left edge; the cursor is `grab`.
- **Source while dragging:** 45% opacity; the bar becomes a dashed outline in its position colour.
- **Ghost:** a white card with the time and bar, tilted 1.5°, with a lifted shadow.
- **Valid cells** in the target column: drop-ok tint. **Invalid cells:** hatched, contents faded, with a "⊘ Busy 11:00–5:00", "⊘ Unavailable" or "⊘ Time off" label. **Target cell:** drop-over tint and 2px ring.
- **Live hint** (dark tooltip beside the target): "Jordan: 44 h → 52 h, +8 h overtime, +$219 OT. Omar: 32 h → 24 h. Net labor +$81." The keyboard equivalent is shown in the legend: Tab to a shift, Enter for details, M then arrows to move, Esc to cancel.

### Toolbar
- Week picker (‹ range ▾ ›) plus "This week". Position filter chips (pressed = ink fill, with the position swatch outlined). A "Problems only" switch. A person search box. Filters hide whole rows and keep the open-shifts row.

### Labor strip
- Scheduled h and Total each carry a "▲ 12 h vs last week" / "▲ $214 vs last week" delta. The budget meter is labelled "Downtown weekly budget $7,400": regular pay is solid, overtime is hatched, and there's a key with percentages. **The sales forecast is removed** (there is no sales data).

### States (all in `index.html` via `?state=`; framed in `states.html`)
- **Empty:** the grid stays in place (names, empty tracks) and a centred card offers "Copy last week" (primary, with counts and "re-checked against time off and availability") and "Start from a template". Publish is disabled: "Add shifts to publish."
- **Loading:** a skeleton in the grid's shape (header blocks, coverage strip, label + track pairs in cells) with a shimmer that stops under `prefers-reduced-motion`.
- **Published:** the draft banner becomes an accent-tinted record ("Published Fri Sep 25 at 4:12 pm. 11 people were notified in the app…"). An edited shift gets a blue pending ring. Publish becomes "Send 1 update", with "Luis gets an in-app update when you send."

### Mobile (employee)
- Kraft hero: "Next shift: tomorrow, Mon Sep 28" with an "in 15 h 20 min" countdown pill, the time at 64px, role and store in bold, break and co-workers, the shift on a day track, and "Add to calendar" / "Request a swap".
- An incoming trade (caution stripe = needs you) shows a give/take pair and Decline / Accept. Then the week list (tappable rows with chevrons), then the time-off entry. Bottom tab bar with icons and a badge.
- Every tap target is at least 44×44px (checked by script).

## Revised after self-review
- **Status words overflowed at 1280** in the first v2 build. A CSS specificity clash let `.note`'s `display` beat the container query. Fixed, and the threshold was re-measured to 176px.
- **Short position words still overflowed** narrow cells ("5:00–10:00 Assign"). Narrow cells now use compact times, which freed about 25px.
- **The header wrapped at 1280** (Publish dropped to a second line). Under 1360px "Copy last week" leaves the header (it's still in the empty state) and the reason text narrows.
- **Rail open-shift items rendered as dark blocks** because the class `.n` collided with the nav badge style. Renamed.
- **Mid-drag hint covered the ghost.** Moved further left.
