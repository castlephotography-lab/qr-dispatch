import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource
} from '@zxing/library';
import { startServer } from './server.mjs';

const root = path.resolve('test-results');
const browserExecutable = process.env.QR_DISPATCH_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
await mkdir(root, { recursive: true });

const server = await startServer({ port: 4174 });
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
const context = await browser.newContext({ serviceWorkers: 'allow' });
const page = await context.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const checks = [];

async function check(name, operation) {
  await operation();
  checks.push(name);
  console.log(`PASS  ${name}`);
}

function decodeCode128(buffer) {
  const png = PNG.sync.read(buffer);
  const luminance = new Uint8ClampedArray(png.width * png.height);
  for (let source = 0, target = 0; source < png.data.length; source += 4, target += 1) {
    luminance[target] = Math.round((png.data[source] * 0.299) + (png.data[source + 1] * 0.587) + (png.data[source + 2] * 0.114));
  }
  const source = new RGBLuminanceSource(luminance, png.width, png.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  return reader.decode(bitmap).getText();
}

try {
  await page.goto(server.url, { waitUntil: 'networkidle' });

  await check('first appointment field receives initial focus', async () => {
    await page.waitForFunction(() => document.activeElement?.id === 'scheduled-0-0');
  });

  await check('Tab and Shift+Tab follow the 28-field schedule order', async () => {
    await page.locator('#scheduled-0-0').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'scheduled-0-1');
    await page.locator('#scheduled-0-3').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'scheduled-1-0');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'scheduled-0-3');
  });

  await check('one, two, four, and fourth-slot-only appointment patterns retain their positions', async () => {
    await page.evaluate(() => {
      const schedule = window.QRDispatch.emptySchedule();
      schedule[0] = ['ONE', '', '', ''];
      schedule[1] = ['TWO-A', 'TWO-B', '', ''];
      schedule[2] = ['FOUR-A', 'FOUR-B', 'FOUR-C', 'FOUR-D'];
      schedule[3] = ['', '', '', 'FOURTH-ONLY'];
      window.QRDispatch.applyState({ date: 'test', mode: 'qr', schedule, workins: [] });
      window.QRDispatch.renderPrint();
    });
    const sections = page.locator('.print-section');
    assert.equal(await sections.count(), 4);
    assert.equal(await sections.nth(0).locator('.print-item.blank').count(), 3);
    assert.equal(await sections.nth(1).locator('.print-item.blank').count(), 2);
    assert.equal(await sections.nth(2).locator('.print-item.blank').count(), 0);
    assert.equal(await sections.nth(3).locator('.print-item').nth(3).getAttribute('data-value'), 'FOURTH-ONLY');
  });

  await page.evaluate(() => {
    const schedule = window.QRDispatch.emptySchedule();
    schedule[0] = ['0001234', 'OPK', '', 'Mix-Case-09'];
    schedule[1] = ['0001234', '', '', ''];
    window.QRDispatch.applyState({ date: 'test', mode: 'qr', schedule, workins: [] });
  });

  await check('duplicate values produce a nonblocking warning', async () => {
    assert.match(await page.locator('#notice').textContent(), /Duplicate entries/i);
    assert.equal(await page.locator('.field-wrap.has-warning').count(), 2);
  });

  await check('empty positions remain blank within their appointment row', async () => {
    assert.equal(await page.evaluate(() => window.QRDispatch.renderPrint()), true);
    assert.equal(await page.locator('.print-section').count(), 2);
    assert.equal(await page.locator('.print-section').first().locator('.print-item').count(), 4);
    assert.equal(await page.locator('.print-section').first().locator('.print-item.blank').count(), 1);
  });

  await check('entered text survives refresh through local autosave', async () => {
    await page.locator('#scheduled-2-0').fill('Refresh-Test');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#scheduled-2-0').inputValue(), 'Refresh-Test');
  });

  await check('QR symbols decode to the exact entered text', async () => {
    await page.evaluate(() => {
      const schedule = window.QRDispatch.emptySchedule();
      schedule[0] = ['0001234', 'OPK', 'Mix-Case-09', 'TEST-LOAD-01'];
      window.QRDispatch.applyState({ date: 'test', mode: 'qr', schedule, workins: [] });
      window.QRDispatch.renderPrint();
    });
    await page.emulateMedia({ media: 'print' });
    const expected = ['0001234', 'OPK', 'Mix-Case-09', 'TEST-LOAD-01'];
    for (let index = 0; index < expected.length; index += 1) {
      const png = await page.locator('.print-item .symbol.qr').nth(index).screenshot();
      const image = PNG.sync.read(png);
      const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height, { inversionAttempts: 'dontInvert' });
      assert.ok(decoded, `QR ${index + 1} did not decode`);
      assert.equal(decoded.data, expected[index]);
    }
    await page.emulateMedia({ media: 'screen' });
  });

  await check('Code 128 symbols decode to the exact entered text', async () => {
    await page.evaluate(() => {
      const schedule = window.QRDispatch.emptySchedule();
      schedule[0][0] = 'TEST-LOAD-01';
      window.QRDispatch.applyState({ date: 'test', mode: 'code128', schedule, workins: [] });
      window.QRDispatch.renderPrint();
    });
    await page.emulateMedia({ media: 'print' });
    const markup = await page.locator('.print-item .symbol.code128 svg').first().evaluate((svg) => svg.outerHTML);
    const png = await sharp(Buffer.from(markup))
      .resize({ width: 522, height: 204, fit: 'contain', background: '#ffffff', kernel: 'nearest' })
      .png()
      .toBuffer();
    await sharp(png).toFile(path.join(root, 'code128.png'));
    assert.equal(decodeCode128(png), 'TEST-LOAD-01');
    await page.emulateMedia({ media: 'screen' });
  });

  await check('Both mode renders one QR and one Code 128 per populated entry', async () => {
    await page.evaluate(() => {
      const schedule = window.QRDispatch.emptySchedule();
      schedule[0] = ['2991234', '15512345', '', ''];
      window.QRDispatch.applyState({ date: 'test', mode: 'both', schedule, workins: [] });
      window.QRDispatch.renderPrint();
    });
    assert.equal(await page.locator('.print-item:not(.blank) .symbol.qr').count(), 2);
    assert.equal(await page.locator('.print-item:not(.blank) .symbol.code128').count(), 2);
  });

  await check('unsupported Code 128 characters block printing without altering the entry', async () => {
    const result = await page.evaluate(() => {
      const schedule = window.QRDispatch.emptySchedule();
      schedule[0][0] = 'LOAD-🚚';
      window.QRDispatch.applyState({ date: 'test', mode: 'code128', schedule, workins: [] });
      return {
        rendered: window.QRDispatch.renderPrint(),
        value: document.querySelector('#scheduled-0-0').value,
        message: document.querySelector('#notice').textContent
      };
    });
    assert.equal(result.rendered, false);
    assert.equal(result.value, 'LOAD-🚚');
    assert.match(result.message, /cannot be encoded/i);
  });

  await check('long identifiers wrap through a print-safe typography class', async () => {
    await page.evaluate(() => {
      const schedule = window.QRDispatch.emptySchedule();
      schedule[0][0] = 'TEST-LOAD-IDENTIFIER-WITH-LONG-SUFFIX-001';
      window.QRDispatch.applyState({ date: 'test', mode: 'qr', schedule, workins: [] });
      window.QRDispatch.renderPrint();
    });
    assert.equal(await page.locator('.identifier.xlong').textContent(), 'TEST-LOAD-IDENTIFIER-WITH-LONG-SUFFIX-001');
  });

  await check('a full 28-entry QR schedule paginates to two Letter pages', async () => {
    await page.evaluate(() => {
      const schedule = window.QRDispatch.emptySchedule().map((row, rowIndex) => row.map((_, columnIndex) => `T${rowIndex + 1}-${columnIndex + 1}-000`));
      window.QRDispatch.applyState({ date: 'test', mode: 'qr', schedule, workins: [] });
      window.QRDispatch.renderPrint();
    });
    assert.equal(await page.locator('.print-page').count(), 2);
    assert.equal(await page.locator('.print-item:not(.blank)').count(), 28);
  });

  await check('multiple work-ins retain four-column grouping and pagination', async () => {
    await page.evaluate(() => {
      const schedule = window.QRDispatch.emptySchedule();
      window.QRDispatch.applyState({ date: 'test', mode: 'qr', schedule, workins: ['W-1', 'W-2', 'W-3', 'W-4', 'W-5'] });
      window.QRDispatch.renderPrint();
    });
    assert.equal(await page.locator('.print-section').count(), 2);
    assert.equal(await page.locator('.print-section').last().locator('.print-item').count(), 4);
    assert.equal(await page.locator('.print-section').last().locator('.print-item.blank').count(), 3);
  });

  await check('cached application reloads with network access disabled', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('h1').textContent(), 'QR Dispatch');
    await page.waitForFunction(() => /offline/i.test(document.querySelector('#system-state-text')?.textContent || ''));
    assert.match(await page.locator('#system-state-text').textContent(), /offline/i);
    await context.setOffline(false);
  });

  await page.screenshot({ path: path.join(root, 'application.png'), fullPage: true });
  console.log(`\n${checks.length} verification checks passed.`);
} finally {
  await context.setOffline(false).catch(() => {});
  await browser.close();
  await server.close();
}
