# Code map

## Folders

| Folder | What is in it |
|---|---|
| `src/domain/` | Pure rules with no database: time zones, conflicts, overtime and cost, coverage, ranking of people for a shift. The unit tests are next to each file. |
| `src/server/services/` | One file for each job. Each function checks permissions, then reads or writes the database, then writes the audit log and the notices. |
| `src/server/authz/` | Who can do what. `policy.ts` holds the rules. `actor.ts` loads the person who is signed in. |
| `src/server/demo/` | The demo data: store and name lists, the planner, and the planted problems. |
| `src/app/(app)/` | The pages that need sign-in. Each page folder has its own `actions.ts` for server actions. |
| `src/content/help/` | The text of the Help page, as plain data. |
| `prisma/` | The database schema and migrations. The first migration also adds the rules that Prisma cannot describe, such as the double-booking constraint. |
| `tests/integration/` | Service tests against a real Postgres database. |
| `tests/e2e/` | Browser tests with Playwright. |
| `design/` | Design concepts and review notes. They are not part of the app. |

## The path of a change

This example follows a manager who drags a shift to another day:

1. `schedule/schedule-board.tsx` sees the drop and calls `moveShiftAction`.
2. `schedule/actions.ts` loads the signed-in person and calls `moveShift`.
3. `services/shifts.ts` checks that the manager runs that store. It saves the change in a transaction and writes the audit log. If the week is published, it sends notices.
4. The page reloads its data through `services/board.ts`, which runs the conflict and cost rules from `src/domain/`.
