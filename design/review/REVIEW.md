# ShiftMate UI/UX review (2026-09-28)

**Reviewed:** the live dev build at localhost:3000 as Admin (Alex Rivera), Manager (Jordan Blake, Downtown) and Employee (Maya Patel). Every route was checked at 1440×900 and 390×844, in light and dark mode. Screenshots are in `shots/` and the scripts that made them are `shoot-routes.mjs`, `shoot-next.mjs` and `interact.mjs`.

**Note on "this week":** in Chicago the demo's clock reads Sunday Sep 27. So "This week" in the app is **Sep 21** (published) and the draft with the planted problems is **Sep 28** (`?week=2026-09-28`). The `?week=2026-10-05` shots show the empty-week state. File names with `next` are the Sep 28 draft.

**Severity:** P1 = broken or confusing, P2 = friction, P3 = polish.

**How it compares with the spec:** the grid holds up well. The time-track bars, coverage strip, hours meters, drag states and review rail are close to the Stockroom v2 spec, and they are the strongest part of the product. Most problems are in three places: phones, the other pages (which look like a stock component kit next to the grid), and the lack of a home page that pulls everything together.

---

## Global (shell, nav, cross-page)

| # | Sev | What I saw | Why it matters | Fix |
|---|---|---|---|---|
| G1 | P1 | No home page. Managers land on `/schedule` for **Sep 21**, a week that is already running. The draft that needs work (Sep 28, which has a blocker) is one click away, and nothing tells them about it (`admin-schedule-d-light.png`). | The first screen answers "what did I publish?" instead of "what needs me today?" The pending time off, the overtime approval and tonight's 6p–10p gap are spread across three pages. | Add the Home dashboard (see `../concepts/dashboard/`). Make it the landing page for managers and admins. |
| G2 | P1 | The bell says "Nothing new" while a time-off request waits on the manager and a blocker holds up next week (`ix-bell.png`). | The one element that looks like "things for you" is empty, so managers learn not to trust it. | Show pending asks in the bell, or put counts on the nav tabs, e.g. `Requests 1`. The v2 spec already had tab badges ("Time off 2", "Swaps 1"), and the build dropped them. |
| G3 | P2 | Nav tabs have no counts. `Activity` was added for managers and admins during this review. It was missing in the first run and present in the second, so the nav is still changing. | Wayfinding. Staff cannot tell which page has something waiting. | Add badges to Requests and Schedule (for draft blockers). Order the tabs Home, Schedule, Requests, Team, Labor, Activity, and move Settings and Help into the account menu. |
| G4 | P2 | Times use two formats. The rail says "Marked unavailable until **13:00**" (24-hour clock) next to "8:00–4:00" (`manager-next-d-light.png`). The swap card says "Mon, Sep 28, **11:00 AM**". | A US retail team reads 12-hour time. Three formats on one screen look careless. | Use one formatter everywhere: "1:00 pm" in sentences, compact "8–4" only inside narrow cells. |
| G5 | P2 | Mixed spelling: "Colours match the schedule" (Settings) and "color" in code and elsewhere. | The product is US-facing. | Use US spelling. |
| G6 | P2 | The dev-only Next.js "N" badge covers the lower right of every page, including the review rail's buttons (`manager-next-d-light.png`). | It hides real buttons in any demo recording. It is not a problem in production. | Set `devIndicators: false` for recordings, or use a production build for the portfolio video. |
| G7 | P3 | "Demo data resets nightly" sits in the top bar as a pill that looks like a button. | It takes the space where badges belong and reads like an action. | Move it to the account menu or show it as a one-time toast after demo sign-in. |
| G8 | P2 | Apart from the schedule, every page is a plain white sheet with a heading and a shadcn table or list. There is no kraft, no Big Shoulders numbers and no track bars. Team, Requests and Activity could be screens from any app (`manager-team-d-light-full.png`, `manager-requests-d-light-full.png`). | This is the "templated" tell. It happens on exactly the pages a portfolio reviewer clicks second. | Reuse the system's own parts: hours meters and position swatches on Team, day-track bars on Requests (show the shifts a time-off request removes), and Big Shoulders counts in page headers. |

## Login (`login-d-light.png`, `login-m-*.png`)

| # | Sev | What I saw | Why it matters | Fix |
|---|---|---|---|---|
| L1 | P2 | The three demo buttons come after the email form, under "or explore the demo". | Nearly every portfolio visitor wants the demo, and nobody has an invite. | Put the demo buttons first. Keep "Have an invite? Email me a sign-in link" below them. |
| L2 | P3 | The kraft half shows only a headline. It does not show the product. | This is the one screen where the product's memorable idea (shifts drawn as bars on the day) could sell itself. | Put a small, static day-track sample under the headline, with 4 bars, the coverage strip and one hatched gap. |

## Schedule (manager and admin)

| # | Sev | What I saw | Why it matters | Fix |
|---|---|---|---|---|
| S1 | P1 | On a 390px phone the page scrolls sideways: `scrollWidth` = 810 at 390 wide. The grid shows the name column plus about 1.5 days (`manager-next-m-light.png`). | A manager checking coverage from the floor sees Monday only, and the whole page wobbles sideways. | Under 640px, change to a day view: a day picker strip (Mon–Sun with problem dots), then one day's people as full-width track rows. Contain any horizontal scroll inside the grid, never the page. |
| S2 | P1 | The shift popover is clipped off the left edge of the phone screen. Its title and the Edit button are cut off (`ix-manager-mobile-popover.png`). | The main action on a shift cannot be reached on a phone. | On phones, show shift details as a bottom sheet. On desktop, keep the popover with collision padding. |
| S3 | P1 | Overtime shows two answers. Omar's row says "45 h, 5 h overtime needs approval", but the labor strip says "Overtime pay (0 h × 1.5) $0" (`manager-next-d-light.png`). The overtime hours fall on his Riverside shifts, but the page never says so. | Budget numbers the manager cannot reconcile make every other number doubtful. | Say where the overtime lands: "Overtime pay $0 here. Omar's 5 h fall on Riverside shifts." Or show "if approved: +$150 across stores". |
| S4 | P1 | Rail items under **Check before publishing** ("Fri 8a–10a is short-staffed") have a red left edge and a red icon (`manager-next-d-light.png`). | This breaks the system's core rule: red means "blocks publishing" and amber or stripes mean "check". The manager cannot tell at a glance what actually stops Publish. | Make coverage gaps amber like the other checks. Keep the red hatch only on the coverage strip itself. |
| S5 | P1 | For screen reader users, a shift button's name gives the time and position only: "11:00 AM to 7:00 PM, Floor". It has no person or day. The "Problems only" switch has no name (`BUTTON ""` in the Tab log, stop 20). | Screen reader users cannot tell whose shift it is or which day. | Make the label "Diego Tanaka, Tuesday Sep 29, 8:00 am to 4:00 pm, Cashier. Check: unavailable until 1:00 pm." Add `aria-label` or `<label>` to the switch. |
| S6 | P2 | Tab order goes through every shift **and** a hidden 20×20 "+ Add shift" button in every cell. That is about 150 stops before the review rail and Publish. Tab stop 1 is visible (skip link, good), but the rail and Publish come after the whole grid. | Keyboard users need many key presses to fix one blocker. | Use a roving tabindex for the grid: one Tab stop, arrow keys move between cells, and Enter opens a cell. Put the rail before the grid in DOM order, or add a "Skip to review" link. |
| S7 | P2 | The "Can't publish yet: approve overtime for 1 person." reason wraps onto two ragged right-aligned lines next to a washed-out Publish button (`manager-next-d-light.png`). In dark mode the disabled Publish looks olive. | The most important sentence on the page is the hardest to read. | Put the reason on the draft banner line ("1 thing blocks publishing: approve Omar's overtime") with the rail link, and keep the header to one line. |
| S8 | P2 | Cells for people who work at another store show "Busy: Riverside 1…", cut off every day (Omar, Maya) (`manager-next-d-light-full.png`). | You cannot read the time, so you cannot tell whether a gap is fixable. | Show "Riverside 10–6" in compact time, drop "Busy:", and use the track bar in a hatched neutral color. |
| S9 | P2 | Row order changes between weeks: Priya is first on Sep 21 and Aisha is first on Sep 28. | Managers find people by where they were last week. | Use a stable order: by position group, then by name. Say the rule in the header ("by role"). |
| S10 | P2 | The published week (Sep 21) still shows "Ready to publish?" with open-shift Assign items, and the primary button is "Publish again" (`admin-schedule-d-light.png`). | "Publish again" is not a real task. The spec had "Send 1 update" only when there are changes. | For a published week with no edits, the rail title becomes "This week" (who's short, open shifts), and there is no primary Publish button. |
| S11 | P2 | The empty week (Oct 5) puts the "Nothing scheduled yet" card **above** a grid of 7 red "short-staffed" rail items, each with "Add a shift". It also says "Publishing notifies 0 people" and shows "Add shifts to publish." in red (`manager-schedule_week_2026-10-05-d-light.png`). | The empty state reads as 7 errors, not as "start here". | Hide coverage items while the week is empty. Make the empty card the only call to action, and keep the reason text muted, not red. |
| S12 | P2 | During a drag, every non-target cell shows "⊘ Busy 8:00–4:00". Omar's cells show both "Busy: Riverside…" and "⊘ Busy: Riverside 10:00–6:00". There is no live cost or overtime hint (`ix-drag-mid.png`). | The spec's best drag moment ("Jordan: 44 h → 52 h, +$219 OT") is missing, and the labels are noisy. | Show labels only on the row under the pointer. Add the live hint beside the target. |
| S13 | P3 | The footer hint "Double-click an empty cell…" shows on phones too. The mobile review sheet says "Click an item" and has both a `›` and an `×` (`ix-manager-mobile-review.png`). | Wrong verbs for touch. Two close controls. | Say "Tap" on touch devices and keep one close control. |
| S14 | P3 | The popover is missing parts the spec listed: the person's week meter, Make open, and cost (`ix-popover-normal.png`). | The popover is where a manager decides whether to reassign. | Add the week meter and "Make open". Show paid hours with cost ("7.5 h, $150"). |
| S15 | P3 | The coverage rule reads "Fewer than 2 people **on the floor**". "Floor" is also a position name. | The manager may think only the Floor position counts. | Say "Fewer than 2 people working 6p–10p." |

## Team (`manager-team-d-light-full.png`)

| # | Sev | What I saw | Why it matters | Fix |
|---|---|---|---|---|
| T1 | P2 | Four columns stretched across 1,350px, with the Rate column at the far right. There are no hours this week, no positions trained, no availability and no status. | The page cannot answer the manager's real questions: who has hours left, who can cover Cashier, who is off. | Add a "This week" hours meter (the grid's meter), position swatches, and an "unavailable Mon" note. Rate moves next to the name, and the width tightens. |
| T2 | P3 | Store names are bold for the home store and muted for the others, with no key. | The meaning is hidden. | Write "Riverside (home), Downtown". |
| T3 | P3 | "+ Add person" is not aligned with the title block. | Polish. | Align it to the title's baseline, as on the schedule header. |

## Requests (`manager-requests-d-light-full.png`, `admin-requests-d-light-full.png`)

| # | Sev | What I saw | Why it matters | Fix |
|---|---|---|---|---|
| R1 | P2 | Omar's time-off card does not show *which* shift it removes, or that Omar is already at 45 h for that week. The admin view shows no store at all. | The manager approves blind and then finds the gap on the grid. | Show the affected shifts as small track bars with "Fri 8–4 Cashier becomes open", and a link: "See on schedule". |
| R2 | P2 | Approve and Deny are 28px tall. The note field is 32px (checked by script). | Managers approve from their phones. | Make every button at least 44px on touch devices. |
| R3 | P3 | "Shift swaps: No shift swaps in the last 30 days." takes up a full section. | Noise. | Collapse empty sections into one line under the heading. |

## Labor cost (`admin-labor-d-light-full.png`, `manager-labor-d-light-full.png`)

| # | Sev | What I saw | Why it matters | Fix |
|---|---|---|---|---|
| B1 | P2 | Three bar charts that look almost the same, all scaled to $8,000. The one fact that matters is not shown: Riverside at 96% of budget and Oak Park at 89% (bars touch the dashed line, and the "$5,325" and "$5,950" labels collide with it). On the manager page the right half is empty. | The chart's job is "am I over?", and it hides the answer. | Lead with one row per store: a budget meter plus "% used" and the "$ left". Show the 8-week trend as small multiples of *% of budget*, and use the space left over. |
| B2 | P2 | Omar Haddad appears twice in the admin people table, once per store. | It looks like a duplicate-data bug. | Use one row per person with the store split inside the row, or name the column "Store (this row)". |
| B3 | P3 | "This week" means Sep 21 here, but "Sep 28" is the draft. The week chips do not say which weeks are drafts. | People confuse drafts with real cost. | Add a "draft" label on draft weeks, with hatched bars. |

## Activity (`ix-activity.png`)

| # | Sev | What I saw | Why it matters | Fix |
|---|---|---|---|---|
| A1 | P2 | The page is empty in the demo: "No changes yet". Seeded requests and a publish exist. | A reviewer's click lands on nothing. | Seed activity rows with the demo reset, or fold this list into the Home dashboard as "Since you last looked". |

## Settings (`admin-settings-d-light-full.png`)

| # | Sev | What I saw | Why it matters | Fix |
|---|---|---|---|---|
| X1 | P2 | "America/Chicago" is shown as a raw time-zone ID. Each store row has a pencil-only edit. "Archive" is a bare text link. The "New position" row has "Blue" preselected, which is the same color as Cashier. There is no save button for positions. | Jargon, and it is unclear how the positions section saves. | Show "Chicago time". Make "Archive" a quiet button, preselect an unused color, and add "Add position". |
| X2 | P3 | The "Save rules" button is small and sits only under the first section. | It is unclear what it saves. | Use a sticky footer: "Save overtime and rest rules". |

## Employee: My shifts (`employee-my-shifts-m-light.png`, `-d-light-full.png`)

| # | Sev | What I saw | Why it matters | Fix |
|---|---|---|---|---|
| E1 | P1 | The hero says "**Next shift**: Sunday, Sep 27" next to an "on now" pill. | This contradicts itself. The spec had "Next shift: tomorrow … in 15 h 20 min". | While a shift is running: "On now until 7:00 pm, 3 h 10 min left". Otherwise show "Next shift" with a countdown. |
| E2 | P2 | There is no bottom tab bar on phones. Nav is behind a hamburger. The spec had My shifts, Open shifts, Swaps and Time off tabs with badges. | Hourly staff live on their phones, and every trip costs 2 taps. | Add the bottom tab bar under 640px. |
| E3 | P2 | "Offer a swap" and "Cancel offer" are 28px tall. The chip "×" on Availability is 14×14 (checked by script). | Below the 44px touch target, for the users with the smallest screens. | Use a minimum height of 44px on touch devices. |
| E4 | P2 | On desktop the hero and list sit in the left half and the right half is empty. | It looks unfinished. | Use two columns: hero plus list on the left, and "This week at a glance" (hours meter, time off, swaps) on the right. |
| E5 | P3 | Maya's approved time off (Mon Oct 5) does not appear in her own "Coming up" list. | Staff check one place. | Show time-off days in the list as hatched "Time off" rows. |

## Employee: Store schedule, Availability, Requests

| # | Sev | What I saw | Why it matters | Fix |
|---|---|---|---|---|
| P1e | P2 | On a phone the store schedule shows about 1.5 days (`employee-schedule-m-dark.png`). The employee's own row is not highlighted. | "Who am I working with Saturday?" needs 3 swipes and a search. | Use the same day view as S1, with the employee's own row pinned at the top and tinted. |
| P2e | P3 | The day headers show "45 h" with no label (`employee-schedule-d-light.png`). | Unclear numbers are noise for staff. | Hide day totals for employees, or label them "45 h scheduled". |
| P3e | P2 | Availability: Monday shows "Cannot work: All day", yet Maya is on Monday's schedule, with no hint of the clash. The disabled "Block all day" does not explain itself. Save stays disabled with no "unsaved changes" state (`employee-availability-m-light.png`). | Staff cannot tell what their manager will see. | Show "Applies from today. You're on Mon Sep 28, 11–7. Ask for time off instead?" Enable Save when anything changes, and say "Saved" afterwards. |
| P4e | P3 | The time-off form uses the browser's "mm/dd/yyyy" date fields. | Clunky on phones. | Use a range picker, or two date fields that show the shifts the dates would remove. |

## Dark mode

Dark mode works everywhere. I found no unreadable text by eye. Issues: the disabled Publish button (S7), and the sheet and page backgrounds are close (#211A13 on #16110C), so the "sheet on cardboard" edge nearly disappears. A 1px `--border` edge on `.sheet` in dark mode would fix it. The labor bars are bright orange in dark mode and clash with the muted chrome. `--primary` at 80% mixed into `--card` would sit better.

## Not verified

- Loading and error states. The loading skeleton exists (`schedule/loading.tsx`), but the local dev server was too fast to catch it. I did not force errors.
- I did not click through Approve, Publish, Delete, Assign or a completed drop, as instructed, so their success toasts and undo are unchecked.
- I did not run a contrast script against the live CSS. The concept's `contrast.cjs` covers the tokens, not the shadcn component overrides.
- Real touch drag, and screen reader output beyond the accessible names.

---

## Top 10 (ranked by impact ÷ effort)

1. **Home dashboard as the manager landing page** (G1). It fixes "where do I start" for every manager session. Medium effort. The data already exists.
2. **Red means blocks, only** (S4): turn coverage-gap rail items amber. Small effort, and it repairs the system's core semantics.
3. **Tab badges and a truthful bell** (G2, G3): counts for pending requests and draft blockers. Small effort.
4. **Phone schedule as a day view, with no page-level sideways scroll** (S1, P1e). This is the biggest mobile fix. Medium effort.
5. **Shift details as a bottom sheet on phones** (S2). Small effort, and it unblocks editing on phones.
6. **Accessible names for shifts and the Problems switch, plus a roving tabindex** (S5, S6). Small to medium effort.
7. **Explain cross-store overtime in the labor strip** (S3). Small effort. It removes the "numbers don't add up" moment.
8. **One time format** (G4). Small effort, and it touches every page.
9. **Employee phone basics**: the "on now" hero copy, a bottom tab bar, and 44px targets (E1, E2, E3). Small to medium effort.
10. **Give Team, Requests and Labor the system's own parts** (G8, T1, R1, B1): hours meters, track bars, and budget-first labor. Medium effort. It turns "templated" into "one product".

---

## Home dashboard proposal

**Mockup:** `../concepts/dashboard/index.html` (desktop; "Admin view" and dark mode are toggles in the mockup bar, or `?role=admin`, `?theme=dark`) and `mobile.html`. **Screenshots:** `dashboard-light.png`, `dashboard-dark.png`, `dashboard-admin.png`, `dashboard-1024.png`, `dashboard-mobile.png` (full page), `dashboard-mobile-fold.png` (first screen), `dashboard-mobile-dark*.png`.

**Data:** Downtown on Sunday Sep 27 at 8:10 am. This matches the live demo: the Sep 21 week's Sunday column, the Sep 28 draft's problems, Omar's time-off request, and Maya's swap offer.

**The one idea:** the grid's time track, turned into a single day. The home page does not open on a row of number tiles. It opens on today's floor: every person as a bar on 6a–11p, a "now" line, and a coverage histogram on the same axis. The histogram shows open shifts as dashed "if filled" caps, and the gap is hatched red through every row. A manager sees "nobody after 7 tonight" before reading a word.

| Order | Widget | Question it answers | Data it needs (already in the app) |
|---|---|---|---|
| 0 | One-sentence brief with links | "Anything on fire?" | Today's coverage gaps, the count of pending requests, the next week's status and its blocker count |
| 0 (admin) | Three store cards | "Which store needs me?" | For each store: today's gaps, open shifts, pending requests, week cost against budget |
| 1 | Today on the floor (day track) | Who's on, who's next, where the holes are | Today's shifts at this store with positions, today's open shifts, coverage per hour, store hours, the minimum headcount |
| 2 | Waiting on you | What only I can decide | Pending time off (with the shifts it frees), overtime approvals, swaps that need a manager, sorted by whether they block publishing |
| 3 | Next week (draft readiness) | "Can I publish, and what's stopping me?" | Week status, the review-rail items (blocks, checks, open shifts), 7 coverage strips, the number of people to notify |
| 4 | Labor against budget | "Am I on budget this week and next?" | Weekly labor cost and budget for this week and the draft |
| 5 | Close to overtime next week | "Who can't take more hours?" | Hours per person across all stores, the overtime limit, approval state |
| 6 | Since Friday | "What changed while I was off?" | The activity log since the viewer's last visit |

**Why this order:** the first screen answers today's problems (they cost money in hours), then decisions only the manager can make (they block other people), then next week (it has a deadline but not an urgent one), then money and hours (checked, not acted on). Phones use the same order. Labor and hours drop below the fold, and a bottom tab bar replaces the hamburger.

**Why not number tiles:** "Scheduled 262.5 h / $5,250 / 71%" tiles tell a manager nothing to do. Each widget here ends in an action (Assign, Approve, Open the draft), and numbers appear only next to the thing they judge.

**Employee home:** `/my-shifts` already fills this role. Fix E1–E5 above, and add a "This week" hours meter and an "Open shifts you can pick up" row. No separate dashboard is needed.
