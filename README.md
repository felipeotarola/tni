# Telecom Number Intelligence MVP

API-first MVP for Swedish mobile number enrichment.

## Run

```bash
npm install
npm run dev
```

Server starts on `http://localhost:3000`.

## Endpoints

- `POST /api/lookup`
- `POST /api/batch-lookup`
- `GET /api/health`

### `POST /api/lookup`

Request:

```json
{
  "phone_number": "0701234567"
}
```

Response shape:

```json
{
  "number": "+46701234567",
  "operator": "Tele2 Sverige AB",
  "brand_guess": "Comviq",
  "network": "Tele2",
  "binding": {
    "status": "possible_binding",
    "risk": "medium",
    "confidence": 0.6
  },
  "metadata": {
    "is_ported": true,
    "sources": ["PTS_OPEN_DATA"],
    "last_checked": "2026-03-31T12:00:00.000Z"
  },
  "confidence": {
    "operator": 1,
    "brand": 0.6,
    "binding": 0.6
  }
}
```

### `POST /api/batch-lookup`

Request:

```json
{
  "numbers": ["0701234567", "0731234567"]
}
```

Response includes successful `results`, failed `errors`, and a `summary`.

## PTS Integration

Primary source is PTS open data, with this verified contract:

- Base URL: `https://data.pts.se` (override with `PTS_BASE_URL`)
- Endpoint: `GET /v1/operator/{ndc}/{nummer}`
- Example: `GET https://data.pts.se/v1/operator/70/1234567`
- Response shape: `{"number":"70-1234567","name":"Telia Sverige AB"}`
- Auth: none required for tested endpoint

The service converts `+46701234567` into:

- `ndc = 70`
- `nummer = 1234567`

If PTS fails, service falls back to local `number_ranges` mapping.

## Persistence and Migrations

Persistence is SQLite (`better-sqlite3`) with automatic SQL migrations on first DB access.

- Default DB path: `data/tni.sqlite`
- Override path with `DATABASE_PATH`
- Migration files:
  - `migrations/001_init.sql`
  - `migrations/002_seed_operator_mapping.sql`
  - `migrations/003_seed_number_ranges.sql`

Tables:

- `lookups`
- `operator_mapping`
- `number_ranges`
- `_migrations` (internal migration tracking)

## Tests

Run:

```bash
npm run test
```

Covered:

- invalid/non-mobile input
- PTS success response handling
- fallback when PTS fails
- batch validation errors
- batch partial success with per-number error reporting

## Notes

- Supports Swedish mobile numbers only (`07xxxxxxxx` and equivalent `+46` forms).
- Brand and binding are heuristic signals, not contractual truth.
- Lookup cache is in-memory in addition to persisted `lookups`.
