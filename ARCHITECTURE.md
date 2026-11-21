# Lifestyle architecture

Lifestyle is built in layers so that the database can be swapped (mock today; Supabase, Firebase or Postgres
behind an API later) without touching screens, workflows or business rules. This document is the standard
for all new work.

The app is a no-build vanilla JS app made of classic scripts that share one global scope, so `file://` keeps
working. Layers are folders, and load order in `index.html` enforces the dependency direction:
a layer may use the layers listed before it, never the ones after it.

## The layers

| Layer | Folder | Owns | Must not |
|---|---|---|---|
| **Domain** | `scripts/domain/` | Entities (`models.js`), controlled values (`enums.js`), errors (`errors.js`), rules (`rules/`), schemas (`validation.js`) | touch the DOM, storage, a provider or the network |
| **Data access** | `scripts/data-access/` | Repository contracts (`contracts.js`), the provider factory (`provider.js`), the mock provider (`mock/`) | contain business workflows, or return a provider's own row/document objects |
| **Infrastructure** | `scripts/infrastructure/` | Identity (`auth.js`); future provider SDK adapters, file storage, notifications | be called from screens |
| **Application** | `scripts/application/` | Permissions, the server-state cache (`store.js`), read selectors (`selectors.js`), workflows (`services/`), the composition root (`bootstrap.js`) | render UI |
| **Presentation** | `scripts/features/`, `scripts/components/`, `scripts/core/`, `index.html`, `styles/` | Screens, components, gestures, UI state, loading / empty / error states | query a provider, keep a copy of server data, or implement a business rule |

`scripts/data/` holds the mock database's contents (seed datasets). Only the mock provider's seed mapper
(`scripts/data-access/mock/seed.js`) reads them.

### How a screen works

- **Reads:** selectors such as `getSiteById`, `getRosteredSiteId`, `getTimesheetsByDate`, `getCrewLogs`,
  `getAttendance`, `getMyAttendance`, `getSiteLogs`, `getDrawings`, `getSitePhotos`, `getTools`, `getEmployees` and `getLeaveBalance`. They are synchronous reads of the cache.
- **Changes:** a service, such as `await timesheetService.submit(...)`, `equipmentService.transfer(...)` or
  `sitesService.archive(...)`. Wrap each call in `runUiAction` (`scripts/utils/async-ui.js`). It marks the
  button busy and shows the error's `userMessage` under the button (toasts are switched off). A success
  state is shown only after the service resolves.
- **Staying current:** call `appStore.subscribe(render, ['collection'])`, or `subscribeSites(render)`, so the
  screen redraws when that data changes, wherever the change came from.
- **UI state:** the selected date, open sheets, drafts and search text stay in the screen's own state.

### How a service works

Every change follows the same steps (`services/service-kit.js`):

1. Find out who is acting: `kit.actor()`.
2. Check that they may: `Permissions.assert(...)`.
3. Validate the input with domain rules.
4. Write through the repositories, inside `provider.transaction` whenever more than one record changes.
5. Record an audit entry in the same transaction.
6. Put the saved records in the cache with `store.upsert`. This happens only after the provider accepted
   them; there are no optimistic updates yet.
7. Return the saved record, or throw an `AppError`.

## Repository contracts

These are defined in `scripts/data-access/contracts.js`. Every method is async and returns plain model
objects, which are copies of the stored data.

| Repository | Methods |
|---|---|
| `sites` | `list({includeArchived})`, `getById`, `create`, `update`, `archive`, `restore` |
| `employees` | `list`, `getById` |
| `roster` | `list({employeeId, siteId, from, to})` (siteId matches any stint), `getForEmployeeOnDate`, `assign` (unique per employee and day; optional `stints` for a split day), `remove` |
| `timesheets` | `list({employeeId, from, to, status})`, `getById`, `getForEmployeeOnDate`, `create` (unique per employee and day), `update` |
| `crewLogs` | `list({date, siteId, from, to})` |
| `siteLogs` | `list({siteId})`, `create` |
| `drawings` | `list({siteId})`, `create` (one record per site and sheet; a new revision replaces it) |
| `sitePhotos` | `list({siteId, logId})`, `create` |
| `attendance` | `list({date, siteId, employeeId})`, `signIn` (one record per employee and day; signing in again reopens it), `signOut` |
| `costCodes` | `list` |
| `equipment` | `list`, `getById`, `create`, `update` (details only), `listAllocations`, `moveUnits` (atomic: checks the source bucket, decrements it and removes it at 0, increments or creates the destination, reconciles the total) |
| `leave` | `listRequests`, `getRequest`, `createRequest`, `updateRequest`, `getBalance`, `updateBalance` |
| `schedule` | `listTasks`, `getTask`, `createTask` (an id may be given: undo), `updateTask`, `removeTask`, `addChecklistItem` / `updateChecklistItem` / `removeChecklistItem` (one item at a time), `listTrades`, `saveTrades` (a trade in use can't be removed) |
| `chats` | `list`, `getForSite` (a site's group chat) |
| `chatMessages` | `list({chatId})` |
| `availability` | `listRequests`, `getRequest`, `listResponses`, `createRequest` (one active request per tool; a repeated idempotency key replays the first; site and chat come from the tool's record, and the request and its chat message are created together), `respond` (compare-and-set: the first answer wins, then only the holder or an override; updates the tool and appends the response history), `expireDue` |
| `notifications` | `list({recipientId})`, `createMany` (unique per recipient and dedupe key), `markRead` (own only), `markAllRead` |
| `audit` | `record`, `list` |
| provider | `transaction(async repos => ...)`, `subscribe(fn)` (optional realtime: changed tables), `name` |

## Data models

The models are defined in `scripts/domain/models.js`, and their runtime schemas in `scripts/domain/validation.js`.
The entities are:

- Site (`kind`: a construction site, or the factory - an equipment location that never appears in site pickers; `getActiveSites` lists construction sites, `getEquipmentLocations` adds the factory)
- Employee
- RosterAssignment
- Timesheet, which owns its TimesheetBlocks
- CrewLog
- Attendance (a site sign-in: who, which site, which day, signed in and out timestamps)
- SiteLog (a daily site log: site, day, title, notes, author)
- Drawing (the current revision of a drawing sheet: sheet number, title, discipline, revision, issue date)
- SitePhoto (a photo taken on site, usually attached to a SiteLog). SiteLogs and SitePhotos carry `tradeIds` (the schedule's trades) - the tags Site search filters by; `SiteSearchRules` (domain) does the matching
- CostCode
- Tool (`trackingType` 'individual': one asset with its own `siteId` and `status`, `siteId` null = unassigned; 'quantity': identical units under one record with `totalQuantity`)
- EquipmentAllocation (where a quantity-tracked tool's units are: unique per tool, site and status; positive quantities that add up to `totalQuantity`, out-of-service units included)
- LeaveRequest
- LeaveBalance
- ScheduleTrade (a trade on the schedule: name, colour) and ScheduleTask (a site booking: trade, what, company (`crew`), arrival window, where, scope (`notes`), from - to; a milestone is a stage gate on its due day and owns a checklist whose ticks record who and when - progress is always counted from the checklist, `ScheduleRules.progress`)
- Site also carries its construction `stage` and, for a site with a key safe, `lockbox` / `accessNotes` (the Site Hub's Site Access sheet)
- Chat (the server's view of a chat: id, name, kind and, for a site group chat, its site)
- ChatMessage (a structured chat message; an availability card references its request and stores no copy of its state)
- AvailabilityRequest (one "is this tool free?" asked of a tool's site: the one record the Tools card, the chat card and the notifications all show)
- AvailabilityResponse (the history of answers and ETA changes)
- Notification (one person's in-app notification, with a deep link to a chat message)
- AuditEntry

The rules every model follows:

- Stable string ids.
- Relations are stored as ids, never as copied names or addresses.
- Dates are `YYYY-MM-DD`, times are `HH:MM`, and timestamps are ISO 8601.
- Every status is an enum value.
- Permanent records (sites, employees, cost codes, equipment) are archived, never deleted.
- Derived values (hours, totals, names) are calculated when needed and never stored.

## Services

| Service | Workflows |
|---|---|
| `sitesService` | `create`, `update` (rename), `archive`, `restore`. Needs admin or project manager. |
| `rosterService` | `assign`, `moveEmployee`, `splitDay` (several sites in one day: ordered `{siteId, start, end}` stints, no overlaps, `RosterRules`), `unassign`. Needs a supervisor or above. Reads: `getRosterDay`, `getRosterCrew`. |
| `timesheetService` | `submit`: validates, works out ROSTERED / TRANSFERRED / MANUAL from the roster, upserts and audits. `approve` and `reject`: needs a supervisor or above, and never on your own timesheet. |
| `crewLogService` | `forSiteOnDate`: matched on date and site id. `copyBlocks`: returns fresh draft blocks and never submits. |
| `attendanceService` | `signIn` and `signOut` for the signed-in employee on a given day (the Home card's day). Refuses an archived site or signing in at a second site while still signed in elsewhere. Timestamps come from the provider; every change is audited. |
| `siteContentService` | `addDrawing`: validates the sheet, title, discipline and revision and records it in the site's drawing register (a new revision of a sheet replaces the old; the same revision is a conflict). `addLog`: validates the title, notes, active site and up to 6 photos, then saves the log and its photos in one transaction with audit entries. `addPhotos` (Add Photo): up to 6 photos with one description, tag and trade tags, not tied to a log. `setPhotoTrades`: re-tag a photo's trades. A log's photos take its trade tags. |
| `equipmentService` | `transferUnits` / `setUnitStatus`: move N units of a quantity-tracked tool between buckets (only available units transfer; they arrive In Use at a site, Available at the factory). `transfer`: an available tool moves, a tool in use gets a move request, and a tool in service is refused. `register`: validates name, category (`ToolCategories`), active site and quantity, refuses a duplicate name at the same site, and adds the tool as Available with an audit entry. |
| `scheduleService` | `saveTask` (create / edit, with company, arrival window and scope; a new milestone starts from a checklist template), `deleteTask` / `restoreTask` (undo), `copyTask` (+1 week, checklist unticked), `makeMilestone`, `toggleItem` / `setItemNote` / `addItem` / `removeItem` / `restoreItem`, `saveTrades` (supervisors and above). |
| `availabilityService` | `request`: asks a tool's site whether an in-use tool is free; the database refuses a second active request for the tool (30-minute cooldown), a tool that is available, in service, at an inactive site or at a site without a group chat, and replays a retried submit. Notifies the site's members today (rostered there or signed in there, active, not the requester), each once. `respond` (available / in use with an ETA / missing) and `updateEta`: only site members, never your own request (admins excepted), supervisors and above may override; ETAs are worked out from a preset or a clock time by the service. Tells the requester; a missing tool also alerts the site's supervisors (or the directors). Notifications are delivered after the change is saved, so a failed delivery never undoes it. `sweepExpired`, `markNotificationRead`, `markAllNotificationsRead`. |
| `leaveService` | `request`: checks working days, the balance and overlaps. `approve` and `reject`: the balance is deducted in the same transaction. |

## Errors

Every failure is an `AppError`, defined in `scripts/domain/errors.js`. Each one carries:

- `code`: one of `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `PERMISSION_DENIED`, `UNAUTHENTICATED`, `NETWORK` or `UNKNOWN`.
- `message`: technical, meant for logs.
- `userMessage`: safe to show a person.
- `details`: per-field problems, for validation errors.

Providers translate their own errors into `AppError` and keep the original on `cause`. A raw provider error
is never shown to a user.

## Identity and permissions

- **Identity:** `scripts/infrastructure/auth.js` answers who is signed in. Today it is a mock session that
  starts as `team-1`, and `signInAs` can switch user in development and tests.
- **Permissions:** `scripts/application/permissions.js` maps an employee's job category to a role (admin,
  project manager, supervisor, employee or contractor) and each action to the roles allowed to do it.
- **Where rules are enforced:** services check permissions on every change. A real backend must enforce
  the same rules again (row-level security or server checks); hiding a button protects nothing.
- **Secrets:** never put a service-role or private key in frontend code. `scripts/config/app-config.js`
  only ever holds public settings.

## Connecting a real database

1. Create `scripts/infrastructure/<name>/<name>-provider.js` that implements every method in
   `REPOSITORY_CONTRACTS`. It should map rows to models, translate errors to `AppError`, run
   `transaction` as a real database transaction or server function, and enforce the schemas and unique
   keys.
2. Add a `case '<name>'` in `createDataProvider` (`scripts/data-access/provider.js`), then set
   `APP_CONFIG.dataProvider.provider`. Put only public keys in the config.
3. Replace the body of `createAuthSession` with the identity provider. Its interface stays the same.
4. Load timesheets and crew logs by employee and date range in `bootstrap.js` instead of loading everything.
5. Implement `provider.subscribe(fn)` with the backend's change feed. `bootstrap.js` already refreshes the
   changed collections, so other users' changes appear live. The mock does this between browser tabs
   (`persistence: 'local'`); `?as=<employeeId>` signs a tab in as someone else and `?reset-data` restores the seed.
6. Run each `availability` method as a server function that reads the caller from the auth session, and send
   real push notifications (APNs, Web Push) from the notifications table; the app delivers in-app only.

Steps 1 to 5 don't change screens, services or domain rules. The tests in `tests/` run against any provider
that passes `assertImplementsContracts`.

Database-side requirements:

- **Foreign keys:** every `*Id` field.
- **Unique keys:** `equipmentAllocations (toolId, siteId, status)` with `quantity > 0` and a check that a tool's buckets sum to its `totalQuantity`, `roster (date, employeeId)`, `timesheets (date, employeeId)`, `notifications (recipientId, dedupeKey)`,
  `availabilityRequests (requesterId, idempotencyKey)`, and one active availability request per tool (a partial
  unique index on `toolId` (and `siteId` for quantity-tracked tools) where the request is pending or in use).
- **Indexes:** on `date`, `employeeId` and `siteId`.
- **Soft archive:** `active` on permanent tables.
- **Audit:** an append-only audit table.
- **Atomic workflows:** timesheet submit with its audit entry, and leave approval with its balance update,
  must each happen all at once or not at all.

## Testing

- `node --test tests/*.test.js` runs the domain, repository and service tests. It uses Node's built-in
  runner, so there is nothing to install, and needs no browser.
- `tests/helpers/load-app.js` loads the real scripts into an isolated context and builds a fresh provider,
  cache and set of services for each test.
- The integration flows (several screens showing one change, Timesheets following roster changes, loading
  and error states) are browser tests driven by puppeteer. They are not in the repo yet; see the remaining
  work below.

## Shared UI components

Repeated page elements are one component each, styled from the tokens in `styles/tokens.css`. Use the
class; don't copy utility strings onto a new element.

| Component | Stylesheet | Used by |
|---|---|---|
| Search field (`.search-field`, `--sheet` variant) | `styles/search-field.css` | Messages, Team, Tools & Gear, Procore projects |
| Filter pills (`.filter-bar`, `.filter-pill`, `--inset` variant) | `styles/filter-bar.css`, `setActiveFilterPill()` | Messages, Notifications, Team, Tools & Gear, Trade Schedule (trades and weeks) |
| Buttons (`.btn` + `--primary`, `--secondary`, `--card` pill with glass tones `--glass` / `--glass-emerald` / `--glass-blue` / `--glass-amber` and `--compact`, `--cta` with `--cta-emerald` / `--cta-blue`, `--destructive`, `--icon`, `--round`, `--block`) | `styles/buttons.css` | Tools (cards, + Add, the add sheet, the transfer sheet); use for every new button |
| Sheets and modals (`.sheet-scrim`, `.sheet`, `.sheet-grab`, `.sheet-handle`, `.sheet-head`, `.sheet-title` / `.sheet-subtitle`, `.sheet-close`, `.sheet-body`, `.sheet-foot`, `.sheet-btn` / `--secondary` / `--text` / `.is-tone-blue` / `.is-tone-amber`, `.sheet-label`, `.sheet-input`; `--sheet-*` tokens) | `styles/sheet.css` (the Time sheet's design, the single source; the Time sheet's own classes share its rules) | Every modal: `openModal`, Time, Tool Transfer, Crew, Choose Site, the account sheet (via its tokens), the date picker. New modals call `openModal` or compose these classes. |
| Header round buttons (`.nav-back`, `.nav-action`) | `styles/top-bar.css`, `--nav-circle-*` tokens | Every pushed screen (the Schedule shows its site's name in the back pill: "‹ Lugarno") |
| Snack bar (`showSnack(message, action?, fn?)`, `#app-snack`) | `scripts/components/snack.js`, `styles/snack.css` | "Copied", "Booking deleted · Undo", "Photos added": the one transient confirmation, above every screen and sheet (toasts stay off) |
| Progress ring (`renderProgressRing(p, { size, stroke, key, tone })` + `animateProgressRings(root)`, `progressRingTone(status)`, `lightProgressCard(card, tone)` / `.ring-lit`) | `scripts/components/progress-ring.js`, `styles/progress-ring.css` | A milestone checklist's done / total as the Time screen's chunky conic ring, coloured by state (amber→gold under way, emerald→mint complete, crimson→coral overdue): the Site Hub milestone card and the Schedule's cards and booking sheet draw it from the same record. `.ring-lit` cards get a bloom behind the ring and a directional edge in the same colour (the Site Hub milestone card). |
| Conic arc (`conicArcSvg(o)`, `conicPolar`) | `scripts/components/conic-arc.js` | The angular-gradient arc (Fitness-ring style) used by the Time screen's rings and the progress ring |
| Account sheet parts (`.account-control`, `.account-tile`, `--acct-*` tokens) | `styles/account-sheet.css` | The account sheet and its pages |

A view whose side padding isn't 20px sets `--page-gutter` (see `filter-bar.css`) so pill rows still bleed
to the screen edge.

## Rules for new work

1. No business data inside UI code. Add it to the domain and data layers and read it through a selector.
2. Never create a second copy of a master collection.
3. Screens never call a provider. They call a service to make a change and a selector to read data.
4. A business rule has one implementation, in `scripts/domain/rules/` or a service.
5. Nothing in the app depends on which provider is in use. Provider-specific code lives only in its provider.
6. Use stable ids and store relations as ids.
7. UI state stays in the screen. Server data stays in `appStore`.
8. Validation uses the shared schemas and rules.
9. Every async action handles pending, error and success states (`runUiAction`). Never show a success
   before the service has resolved.
10. Refactors keep existing behaviour and appearance.
11. Shared workflows go in a service.
12. Keep it proportional: no layer, abstraction or tool without a present need.

## Remaining migration (in priority order)

These still read their mock datasets directly. Each should get a repository, a selector and, where it
changes data, a service:

1. **Jobs** (`JOBS_DATA`): the Site screen's client details, per-day weather and crew, the Home crew
   preview. Model it as a `Job` linked to a site, with day plans.
2. **Roster card templates** (`ROSTER_CONFIG`): stage, rain risk and wet-weather site for the demo week (the
   Roster screen applies them to that week only; crew now comes from the roster). Fold these into roster
   assignments, or into a `SitePlan` entity.
3. **Account** (`ACCOUNT_DATA`): profile, role sign-off, workwear and the Procore integration status. This
   needs `profile`, `workwear` and `signOff` repositories. Workwear request and collect, and the role
   sign-off, currently change the data in place.
4. **Procore projects** (`PROCORE_PROJECTS`): this should become an integration adapter in `infrastructure/`.
5. **Chats, notifications and the schedule whiteboard**: each needs its own repository.
6. **Two demo "todays"**: Home, Roster, Site Hub and Schedule use Mon 23 Nov (`APP_CONFIG.siteDemoDay`,
   `APP_TODAY`), while Timesheets and the services use 13 Nov (`appClock`). These should be one clock.
7. **Shared UI components:** the site pickers (Timesheets list, transfer roller, schedule select and Site
   switcher) look different on purpose. A shared data source for them already exists through the
   selectors; a shared component would mean a visual change, which needs a design decision.
8. **Bulk tool transfers:** these move the whole record. Splitting a quantity needs a stock or allocation
   model.
9. **Leave request form:** "Request New Leave" still opens a placeholder. `leaveService.request` is ready
   for it.
10. **Browser integration tests:** these should move into `tests/browser/` with a documented puppeteer
    setup.
