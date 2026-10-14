# QR Dispatch

QR Dispatch is a desktop-first, offline-capable warehouse tool for building polished US Letter appointment sheets with QR codes, Code 128 barcodes, or both. It is a static application: order information stays in the browser and is never sent to a server.

## Daily use

1. Open the deployed site in Chrome or Edge and wait for **Offline ready** in the upper-right corner.
2. Type into the 28 scheduled fields. `Tab` moves left-to-right and then into the next appointment row; `Shift+Tab` moves backward.
3. Expand **WORK-INS** only when unscheduled entries are needed.
4. Select **QR Code**, **Code 128**, or **QR + Code 128** in the bottom bar.
5. Select **Print sheet**.
6. In the browser print dialog use:
   - Paper: **Letter**
   - Layout: **Portrait**
   - Scale: **100% / Actual size**
   - Headers and footers: **Off**
   - Margins: leave at **Default**; the application supplies 0.37-inch page margins

The form saves locally while you type. On a different calendar day, old entries are held back and the app asks whether to restore them or start blank. **New day / Clear** always requires confirmation.

## Privacy and offline behavior

- There is no backend, account, analytics script, remote font, CDN, or network API.
- QR and Code 128 libraries are bundled in `dist/vendor/`.
- Entries are stored only in browser `localStorage` on that computer and browser profile.
- The service worker caches every application file after the first successful load.
- If company policy blocks local browser storage, the app displays a visible warning.

### Test offline on the company laptop

1. Visit the deployed GitHub Pages URL once while connected and wait for **Offline ready**.
2. Close the tab, disconnect Wi-Fi/Ethernet, and reopen the same URL from browser history or a bookmark.
3. Confirm the status reads **Working offline**.
4. Enter fictional data, refresh the page, and confirm it returns.
5. Generate a print preview and Save as PDF.
6. Reconnect only after the test is complete.

Clearing site data in the browser removes both saved entries and the offline cache. Visit the deployed URL online again to restore the cache.

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow and needs no build step.

1. Create an empty GitHub repository. Do not add real warehouse orders or operational data.
2. Push this project to its `main` branch.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, select **GitHub Actions** as the source.
5. Open **Actions** and confirm **Deploy QR Dispatch to GitHub Pages** succeeds.
6. Open the Pages URL shown by the deployment and complete the offline test above.

For a manual deployment, publish the contents of `dist/` at the root of any static web host. Do not open `index.html` directly from the file system; service workers require HTTPS or `localhost`.

## Local review and testing

Requires Node.js 20+ and pnpm.

```text
pnpm install
pnpm run serve
```

Open `http://127.0.0.1:4173`. To run the automated browser checks:

```text
pnpm test
pnpm run examples
```

On Windows, the test runner uses Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`. Set `QR_DISPATCH_BROWSER` to another Chromium executable if needed.

## Print examples

- `examples/sparse-schedule.pdf` — sparse appointments, an occupied fourth slot, and work-ins
- `examples/full-schedule.pdf` — all 28 scheduled fields across two pages
- `examples/both-formats.pdf` — combined QR and Code 128 layout

All examples contain fictional values only.

## Validation boundary

The automated suite verifies keyboard order, duplicate warnings, sparse placement, autosave restoration, exact QR decoding, exact Code 128 decoding, all three modes, work-in grouping, full-schedule pagination, and a network-disconnected reload from the service-worker cache. Generated PDFs were inspected at actual Letter geometry for clipping and page breaks.

Production approval still requires printing a sample at 100% and scanning QR and Code 128 symbols with the actual warehouse hardware. Software decoding cannot substitute for that physical test.

## Project layout

```text
dist/                 Static GitHub Pages application
  app.js              State, validation, encoding, pagination
  styles.css          Desktop entry interface
  print.css           Physical Letter print composition
  sw.js               Offline cache
  vendor/             Local encoding libraries and notices
examples/             Fictional sample PDFs and preview images
tests/                Browser, decoding, offline, and example generators
.github/workflows/    GitHub Pages deployment
```
