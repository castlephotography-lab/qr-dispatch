# QR Dispatch V1 test report

Tested in headless Google Chrome on Windows using the same Chromium print engine as desktop Chrome. The automated suite is in `tests/verify.mjs`.

## Automated results

All checks pass:

- Initial focus starts in the 8:00 AM first field.
- Tab and Shift+Tab preserve the 28-field appointment order.
- Duplicate values remain printable and produce a nonblocking warning.
- Sparse hourly rows preserve all four positions.
- Local autosave survives a browser refresh.
- QR symbols decode back to the exact strings `0001234`, `OPK`, `Mix-Case-09`, and `TEST-LOAD-01`.
- Code 128 decodes back to the exact string `TEST-LOAD-01`.
- Both mode renders one QR and one Code 128 per populated entry.
- A full 28-entry schedule creates two Letter pages.
- Five work-ins create two fixed four-column rows with blank trailing positions.
- After the service worker takes control, the app reloads with network access disabled.

## Print inspection

- `sparse-schedule.pdf`: 1 Letter page.
- `full-schedule.pdf`: 2 Letter pages, with four appointment windows on page 1 and three on page 2.
- `both-formats.pdf`: 1 Letter page.
- No QR, identifier, checkbox row, or appointment heading is split across pages.
- QR-only symbols are 1.42 inches square including the standards-preserving generated quiet zone.
- Printed status boxes are 0.125 inches square.
- Empty positions remain blank and empty appointment windows are omitted.

## Required physical acceptance test

Before production use, print each example at 100% / Actual size on the intended office laser printer, disable browser headers and footers, and scan representative symbols with the actual warehouse scanner. Record the printer, scanner model, browser version, and pass/fail result. This physical validation remains intentionally open.
