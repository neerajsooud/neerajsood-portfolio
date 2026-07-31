# Fleet Alpha

Fleet Alpha is a private-first, static vehicle investment operating system for fleet and Turo owners. It runs directly in the browser with no server or build step.

## Run locally

From the repository root:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080/fleet-alpha/`. GitHub Pages can serve the same files directly.

## What it does

- Manages vehicles, monthly earnings, offers, payoff records, maintenance, and incident/claim records.
- Calculates monthly fixed cost, operating profit, equity, hold value, and a configurable recommendation.
- Produces a directional 12-month forecast and suggested exit month.
- Imports one or more Turo-style CSV files with preview, column detection, vehicle mapping, and reservation-ID deduplication.
- Exports and restores a versioned JSON backup.
- Provides sanitized fictional demo data, an empty reset, responsive layouts, and keyboard-accessible forms.

## Privacy and storage

Fleet Alpha stores data in `localStorage` in the current browser. Data is not sent to a backend, but local browser storage is **not encrypted cloud storage**. It can be read by someone with access to the same browser profile and can be lost when browser/site data is cleared.

- Export JSON backups regularly and store them somewhere appropriate.
- Data does not synchronize between browsers or devices.
- GitHub Pages is public static hosting. Never put real earnings, payoff, VIN, claim, or other private records in repository source.
- The included starter records are fictional and clearly labeled as demo data.

## CSV import

Select one or more CSV files on the Data page and choose **Preview import**. Fleet Alpha detects common case-insensitive names for reservation ID, vehicle, trip dates, earnings/net earnings, booked days, and mileage. Exact vehicle names are matched automatically; unmatched rows remain visible and require a vehicle selection before import.

Rows with previously imported reservation IDs are marked as duplicates and skipped. Rows without reservation IDs receive a deterministic fingerprint so repeated imports can still be detected. Imported trips are grouped into one earnings record per vehicle/month.

## Decision logic

- **ADD DATA** — payoff, executable offer/market value, or monthly depreciation is missing.
- **HOLD** — expected next-month operating profit minus depreciation meets the configured hold threshold.
- **PREPARE TO SELL** — hold value is near zero or performance is trending down.
- **SELL NOW** — hold value is negative and current/projected exit economics favor selling.

Forecasts are estimates, not appraisals or financial advice. They use recent average operating profit, the vehicle depreciation assumption, a loan payoff-decline fallback or lease schedule, and configured sale friction. Offers and payoff records are labeled as verified inputs; market values and forecast figures are labeled as estimates.

## Backup schema

Backups contain a `schemaVersion`, timestamps, settings, all entity arrays, and imported reservation IDs. Restore rejects malformed JSON, unsupported future versions, invalid entity collections, and records missing required identifiers. Versioned loading migrates older compatible local data and falls back safely if stored data is corrupt.
