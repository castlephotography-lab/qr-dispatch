import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const examples = path.resolve('examples');
const browserExecutable = process.env.QR_DISPATCH_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
await mkdir(examples, { recursive: true });
const server = await startServer({ port: 4175 });
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });

try {
  async function generate(name, state) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
    await page.goto(server.url, { waitUntil: 'networkidle' });
    await page.evaluate((nextState) => {
      window.QRDispatch.applyState(nextState);
      window.QRDispatch.renderPrint();
    }, state);
    await page.pdf({
      path: path.join(examples, `${name}.pdf`),
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false
    });
    await page.close();
  }

  const sparse = Array.from({ length: 7 }, () => ['', '', '', '']);
  sparse[0] = ['2991234', 'OPK', '', 'TEST-LOAD-01'];
  sparse[2] = ['', '', '', '0005801'];
  sparse[4] = ['15512345', 'joca', '', ''];
  await generate('sparse-schedule', { date: 'example', mode: 'qr', schedule: sparse, workins: ['WORK-IN-01', '5801'] });

  const full = Array.from({ length: 7 }, (_, rowIndex) => Array.from({ length: 4 }, (_, columnIndex) => `${8000000 + (rowIndex * 10) + columnIndex}`));
  await generate('full-schedule', { date: 'example', mode: 'qr', schedule: full, workins: [] });

  const both = Array.from({ length: 7 }, () => ['', '', '', '']);
  both[0] = ['2991234', 'OPK', '', 'TEST-LOAD-01'];
  both[1] = ['0005801', 'Mix-Case-09', '', ''];
  await generate('both-formats', { date: 'example', mode: 'both', schedule: both, workins: [] });

  console.log(`Example PDFs written to ${examples}`);
} finally {
  await browser.close();
  await server.close();
}
