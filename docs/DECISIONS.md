# Decisions

Each entry gives the decision, the reason, and the option that we did not choose.

## Product rules

### Double-bookings are impossible, not only flagged

A Postgres exclusion constraint refuses two overlapping shifts for one person at any store. A warning that a manager can ignore is not safe enough for this rule.

### Other problems are warnings

These problems do not block publishing: unavailability, approved time off, short rest (8 hours by default), a store that the person does not usually work at, and low coverage. A manager can keep a warning with a written reason, and the reason is saved.

### Overtime is per person across all stores

The limit is 40 hours per week at 1.5 times the rate, and an admin can change both. A week with unapproved overtime cannot be published. An approval covers the hours that are scheduled at that time. More hours need a new approval.

### Overtime goes on the last shifts of the week

When a person works at two stores, the store with the later shifts pays the overtime premium. The law in the United States uses a blended rate for people with more than one rate in a week. ShiftMate uses the rate of each shift, which is simpler and close enough for scheduling. A payroll system must do the exact calculation.

### A clean swap does not need a manager

If the coworker accepts and the swap causes no problem and no new overtime, it happens at once. Other swaps go to a manager with the reason. Every swap is on the Activity page. Asking a manager for every swap makes busy managers the bottleneck.

### Published weeks change in place

When a manager changes a published shift, the people affected get a notice in the app at once. A batch of changes that waits for a Send button was in the design, but it adds state that a small team does not need.

### Notices are in the app only

Email and text messages only reach real addresses, and the demo accounts have none. Email is ready to add for sign-in links through Resend.

## Technology

### Next.js with server actions, no separate API

There is one client, so a separate API adds work and more code to secure.

### Better Auth for sign-in links

Auth.js v5 was still a beta release in September 2026. Better Auth 1.7 is stable and has sign-in links and a Prisma adapter.

### Prisma 7.10, pinned

The `latest` tag on npm pointed to a release candidate of version 8.

### Vercel and Neon, both free

Cloudflare Workers on the free plan allow about 10 ms of CPU for each request, which is too little for server rendering with Next.js.

### Times are stored in UTC

Each store has its own time zone. Weeks, days and wall-clock times are calculated in the time zone of the store, so daylight saving time changes stay correct.

### Availability keeps its history

A change closes the old windows instead of deleting them, so an old week still shows why a person was or was not scheduled.

## Design

### The Stockroom design

It has kraft-colored chrome, a white working sheet, Big Shoulders for numbers and Libre Franklin for text. Each shift is a bar on a 6 AM to 11 PM track, so managers see who opens and who closes without reading the times. The coverage strip uses the same track.

### The chart colors are checked, not chosen by eye

A palette validator checked the regular and overtime colors for color blindness and contrast in light and dark mode. Overtime also has a striped pattern, so color is never the only signal.

### Small files

Each file stays at about 150 lines or fewer, so a reader can understand one file at a time.

## Demo data

### The demo rebuilds itself relative to today

Every night, and on the first deploy, the seed builds six past weeks, this week and next week. Next week is a draft only at the Downtown store. It contains planted problems for the manager demo: overtime, an availability conflict, an open shift and a coverage gap. The Riverside store is planned first, so the demo employee always has shifts coming up.

### Two dependency overrides

`package.json` forces `mysql2` 3.24.4 or later and `deepmerge-ts` 8 or later. Prisma and Better Auth bring in older versions with known security problems. ShiftMate does not use MySQL, and the other package only reads our own configuration, so the real risk was low. The overrides remove the warnings. If a Prisma update breaks, remove the `deepmerge-ts` override first and run the tests.
