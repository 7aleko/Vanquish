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
  `getTools`, `getEmployees` and `getLeaveBalance`. They are synchronous reads of the cache.
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
| `roster` | `list({employeeId, siteId, from, to})`, `getForEmployeeOnDate`, `assign` (unique per employee and day), `remove` |
| `timesheets` | `list({employeeId, from, to, status})`, `getById`, `getForEmployeeOnDate`, `create` (unique per employee and day), `update` |
| `crewLogs` | `list({date, siteId, from, to})` |
| `costCodes` | `list` |
| `equipment` | `list`, `getById`, `update` |
| `leave` | `listRequests`, `getRequest`, `createRequest`, `updateRequest`, `getBalance`, `updateBalance` |
| `audit` | `record`, `list` |
| provider | `transaction(async repos => ...)`, `name` |

## Data models

The models are defined in `scripts/domain/models.js`, and their runtime schemas in `scripts/domain/validation.js`.
The entities are:

- Site
- Employee
- RosterAssignment
- Timesheet, which owns its TimesheetBlocks
- CrewLog
- CostCode
- Tool
- LeaveRequest
- LeaveBalance
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
| `rosterService` | `assign`, `moveEmployee`, `unassign`. Needs a supervisor or above. |
| `timesheetService` | `submit`: validates, works out ROSTERED / TRANSFERRED / MANUAL from the roster, upserts and audits. `approve` and `reject`: needs a supervisor or above, and never on your own timesheet. |
| `crewLogService` | `forSiteOnDate`: matched on date and site id. `copyBlocks`: returns fresh draft blocks and never submits. |
| `equipmentService` | `transfer`: an available tool moves, a tool in use gets a move request, and a tool in service is refused. |
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
5. Optionally, subscribe to the backend's change events and call `appStore.refresh(collection)` so other
   users' changes appear live.

Steps 1 to 5 don't change screens, services or domain rules. The tests in `tests/` run against any provider
that passes `assertImplementsContracts`.

Database-side requirements:

- **Foreign keys:** every `*Id` field.
- **Unique keys:** `roster (date, employeeId)` and `timesheets (date, employeeId)`.
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
   preview and the roster's rain arrangement. Model it as a `Job` linked to a site, with day plans.
2. **Roster card templates** (`ROSTER_CONFIG`): stage, crew, rain risk and wet-weather site per weekday.
   Fold these into roster assignments, or into a `SitePlan` entity.
3. **Account** (`ACCOUNT_DATA`): profile, role sign-off, workwear and the Procore integration status. This
   needs `profile`, `workwear` and `signOff` repositories. Workwear request and collect, and the role
   sign-off, currently change the data in place.
4. **Procore projects** (`PROCORE_PROJECTS`): this should become an integration adapter in `infrastructure/`.
5. **Chats, notifications and the schedule whiteboard**: each needs its own repository.
6. **Two demo "todays"**: Home and Roster use 14 Oct (`APP_TODAY`), while Timesheets and the services use
   13 Nov (`appClock`). These should be one clock.
7. **Shared UI components:** the site pickers (Timesheets list, transfer roller, schedule select and Site
   switcher) look different on purpose. A shared data source for them already exists through the
   selectors; a shared component would mean a visual change, which needs a design decision.
8. **Bulk tool transfers:** these move the whole record. Splitting a quantity needs a stock or allocation
   model.
9. **Leave request form:** "Request New Leave" still opens a placeholder. `leaveService.request` is ready
   for it.
10. **Browser integration tests:** these should move into `tests/browser/` with a documented puppeteer
    setup.
