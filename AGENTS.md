# Project Summary

## Problem
Client portal HTMLs (penalisa.html, mesa-de-yeguas.html, casa-de-campo-restrepo.html, etc.) were not loading client-specific data from Firestore. The `clientView.js` was hardcoded to query only by `cuenta` or `cliente` fields, but most Firestore records store the client identifier in the `proceso_uas` field (short names like `'UAS - PENALISA'`).

## Changes Made

### `src/modules/cliente/clientView.js`
1. **Added `proceso_uas` to FIELD_ORDER** — The query now tries `cuenta`, `cliente`, AND `proceso_uas` for each collection, so records stored with short names via `proceso_uas` are found.
2. **Added `CLIENT_ACCOUNT_MAP`** — Maps short client names (e.g. `'UAS - PENALISA'`) to full Firestore account names (e.g. `'CORPORACION CLUB PUERTO PENALISA'`). This covers collections like `ops_mantenimiento` that may not have a `proceso_uas` field, by falling back to querying `cuenta` with the full account name.
3. **Added fallback query** — After trying all fields in FIELD_ORDER with `CLIENT_ID`, if no results are found, it tries `cuenta` with the mapped full account name.

### Client HTMLs
- Added `window.UASOPS_CLIENT_ID` to `casa-de-campo-la-calera.html` (was missing it).

## Seed Data Analysis
- `bitacora`, `misiones`, `planeamiento`, `riesgo` have `proceso_uas` field → queried by short name.
- `mantenimiento` seed data does NOT have `proceso_uas` → needs `CLIENT_ACCOUNT_MAP` fallback.
- `UAS - GRUPO EXITO` has no records in seed data (mapped to empty string, no fallback attempted).

## Architecture Notes
- `clientView.js` uses direct Firestore queries (not the FirebaseDB module).
- Each HTML client page sets `window.UASOPS_CLIENT_ID` before loading `client.js` and `clientView.js`.
- `firebase.js` `_upsertCliente` stores the `cuenta` (full account name) as the primary field, while the parser stores `proceso_uas` separately.
