# Pasienky Pool Timetable Design

## Goal

Build a production-leaning Node.js and Angular application that shows available public swimming lanes for Mestska plavaren Pasienky 50 m.

The source of truth is the Bratislava page:

https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-50m

The backend must find the Excel link associated with the label `Časový rozpis voľných plaveckých dráh pre verejnosť`, download the workbook, parse it, store normalized data in PostgreSQL, and serve cached timetable data to the Angular frontend.

## Scope

In scope:

- Node.js TypeScript backend.
- Angular frontend.
- PostgreSQL persistence through `DATABASE_URL`.
- Protected HTTP endpoint that triggers parsing.
- Public HTTP endpoint that serves timetable data.
- Week-grid desktop UI and stacked daily mobile UI.
- Parser and API tests focused on the real data flow.

Out of scope:

- Calling or configuring the external scheduler that triggers parsing.
- Docker Compose for PostgreSQL.
- User accounts.
- Admin UI.
- Historical analytics beyond import metadata needed for operation.

## Architecture

The repository will contain two applications:

- `server/`: Node.js TypeScript API.
- `client/`: Angular SPA.

The backend owns all scraping, Excel downloading, parsing, validation, and database writes. Angular never talks to Bratislava or SharePoint directly.

PostgreSQL is external. The app reads connection details from `DATABASE_URL`.

Primary backend endpoints:

- `POST /api/admin/parse`
  - Requires `X-Parse-Token`.
  - Compares the header value with `PARSE_TRIGGER_TOKEN`.
  - Downloads and parses the current workbook.
  - Replaces active timetable data transactionally.

- `GET /api/timetable?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Returns cached timetable slots in the requested inclusive date range.
  - Includes last successful import metadata.

## Data Flow

1. External scheduler calls `POST /api/admin/parse` with `X-Parse-Token`.
2. Backend downloads the Bratislava Pasienky page.
3. Backend locates the link associated with `Časový rozpis voľných plaveckých dráh pre verejnosť`.
4. Backend resolves and downloads the linked Excel workbook.
5. Parser converts workbook cells into normalized timetable slots.
6. Backend writes an import run record and replaces the active slots inside a PostgreSQL transaction.
7. Angular requests timetable data with a date range.
8. Angular renders a week grid on desktop and stacked daily sections on mobile.

## Data Model

The normalized slot model will include:

- `id`
- `date`
- `startTime`
- `endTime`
- `availableLanes`
- `note`
- `sourceSheet`
- `sourceRow`
- `importRunId`
- `createdAt`

The import run model will include:

- `id`
- `status`
- `sourcePageUrl`
- `workbookUrl`
- `startedAt`
- `finishedAt`
- `slotCount`
- `errorMessage`

Only slots from the most recent successful import are public.

## Parsing

The parser must inspect the real workbook structure before final assumptions are encoded. It should parse by workbook semantics where possible and preserve source coordinates for debugging.

If the workbook cannot be interpreted into valid slots, the parse endpoint returns `422` and the previous successful timetable remains active.

The parser must not silently invent dates, times, or lane counts. Ambiguous rows should either be skipped with a recorded note when clearly non-data, or fail the import when they appear to be malformed timetable data.

## Frontend

The Angular app will show a practical timetable interface:

- Week navigation.
- Week-grid desktop view.
- Stacked daily mobile view.
- Minimum available lanes filter.
- Last successful import timestamp.
- Loading, empty, and API error states.

Lane count should be visible as text. Color may be used as an additional scanning aid, but not as the only signal.

## Error Handling

`POST /api/admin/parse` responses:

- `401`: missing or invalid `X-Parse-Token`.
- `502`: Bratislava page or workbook fetch failed.
- `422`: workbook downloaded but could not be parsed into valid timetable slots.
- `200`: parse succeeded, with imported slot count and import timestamp.

If a parse fails, existing public timetable data remains unchanged.

`GET /api/timetable` validates date range input and returns a client-usable error for invalid query parameters.

## Configuration

Required environment variables:

- `DATABASE_URL`
- `PARSE_TRIGGER_TOKEN`

Optional environment variables:

- `PORT`
- `BRATISLAVA_PAGE_URL`, defaulting to the Pasienky page URL.

## Testing

Backend tests:

- Parser test using a fixture workbook or generated workbook matching the observed structure.
- Link discovery test for the Bratislava page HTML.
- `POST /api/admin/parse` rejects missing or invalid tokens.
- `POST /api/admin/parse` preserves previous data on fetch or parse failure.
- `GET /api/timetable` filters by date range.

Frontend tests:

- Week grouping renders days and slots correctly.
- Minimum lane filter hides lower-capacity slots.
- Empty and error states render.

Verification before completion:

- Backend tests pass.
- Angular tests or build pass, depending on the generated project setup.
- Type checking passes for both apps.

## Open Implementation Notes

- The exact Excel parser rules depend on the current workbook structure and should be finalized after inspecting the actual downloaded workbook.
- The project directory is currently not a git repository, so design documents and code can be written but not committed unless git is initialized.
