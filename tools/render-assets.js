// Renders the extension icons and Chrome Web Store images with headless Chrome.
// Dev tooling only; nothing here ships in the extension.
//
//   npm run assets          icons/ and store/
//   npm run assets icons    icons/ only
//   npm run assets store    store/ only
//
// Set CHROME_PATH if Chrome isn't in the usual place.

import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = join(ROOT, 'tools', 'assets');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

// Padding (in 96-unit artwork space) per icon size. The 128px icon follows the
// Web Store guideline of 96x96 artwork with 16px of transparent padding.
const ICONS = [
  { size: 16, pad: 1, simple: true },
  { size: 48, pad: 3 },
  { size: 128, pad: 16 },
];

const STORE = [
  { page: 'shot-hero.html', out: 'screenshot-1-overview.png', width: 1280, height: 800 },
  { page: 'shot-settings.html', out: 'screenshot-2-rules.png', width: 1280, height: 800 },
  { page: 'shot-test.html', out: 'screenshot-3-test.png', width: 1280, height: 800 },
  { page: 'shot-admin.html', out: 'screenshot-4-admin.png', width: 1280, height: 800 },
  { page: 'promo-small.html', out: 'promo-small-440x280.png', width: 440, height: 280 },
];

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
};

function iconPage(size) {
  const { pad, simple } = ICONS.find((i) => i.size === size);
  const svg = readFileSync(join(ASSETS, 'icon.svg'), 'utf8')
    .replace(/viewBox="[^"]*"/, `viewBox="${-pad} ${-pad} ${96 + pad * 2} ${96 + pad * 2}" width="${size}" height="${size}"`);
  const hide = simple ? '.detail { display: none; }' : '';
  return `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}${hide}</style>${svg}`;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let body;
    let type;

    if (url.pathname === '/icon') {
      body = iconPage(Number(url.searchParams.get('size')));
      type = 'text/html';
    } else if (url.pathname === '/src/options/harness.html') {
      // The real options page, with demo data in place of chrome.storage.
      body = readFileSync(join(ROOT, 'src/options/options.html'), 'utf8').replace(
        '<link rel="stylesheet"',
        '<script src="/tools/assets/mock-chrome.js"></script>\n  <link rel="stylesheet"',
      );
      type = 'text/html';
    } else {
      const file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
      if (!file.startsWith(ROOT) || !existsSync(file) || file.endsWith(sep)) {
        res.writeHead(404).end();
        return;
      }
      body = readFileSync(file);
      type = TYPES[extname(file)] || 'application/octet-stream';
    }
    res.writeHead(200, { 'Content-Type': type }).end(body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function screenshot(chrome, profile, url, width, height, out, { transparent = false } = {}) {
  const args = [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--force-color-profile=srgb',
    // Icons need transparency; the Web Store wants screenshots without alpha.
    ...(transparent ? ['--default-background-color=00000000'] : []),
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--virtual-time-budget=3000',
    `--screenshot=${out}`,
    url,
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(chrome, args, { stdio: 'ignore' });
    proc.on('error', reject);
    proc.on('exit', (code) =>
      code === 0 && existsSync(out) ? resolve() : reject(new Error(`Chrome exited with ${code} for ${url}`)),
    );
  });
}

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error('Chrome not found. Set CHROME_PATH to the Chrome executable.');
  process.exit(1);
}

const which = process.argv[2] || 'all';
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const profile = mkdtempSync(join(tmpdir(), 'reext-assets-'));

try {
  if (which === 'all' || which === 'icons') {
    for (const { size } of ICONS) {
      const out = join(ROOT, 'icons', `icon${size}.png`);
      await screenshot(chrome, profile, `${base}/icon?size=${size}`, size, size, out, { transparent: true });
      console.log(`wrote icons/icon${size}.png`);
    }
  }
  if (which === 'all' || which === 'store') {
    mkdirSync(join(ROOT, 'store'), { recursive: true });
    for (const { page, out, width, height } of STORE) {
      await screenshot(chrome, profile, `${base}/tools/assets/${page}`, width, height, join(ROOT, 'store', out));
      console.log(`wrote store/${out}`);
    }
  }
} finally {
  server.close();
  rmSync(profile, { recursive: true, force: true });
}
