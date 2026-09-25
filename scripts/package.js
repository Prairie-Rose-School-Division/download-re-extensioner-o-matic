// Builds dist/<name>-<version>.zip for Chrome Web Store upload.
// Uses an allowlist, so tests, tools, docs and dev files are never included.
// No dependencies: writes a standard ZIP with Node's built-in zlib.
// Run with: npm run package

import { deflateRawSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from '../tools/crc32.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INCLUDE = ['manifest.json', 'managed_schema.json', 'LICENSE', 'src', 'icons'];
const EXCLUDE = [/(^|\/)\./, /\.test\.js$/, /\.map$/];

function collect(path) {
  const full = join(ROOT, path);
  if (statSync(full).isDirectory()) {
    return readdirSync(full).sort().flatMap((name) => collect(join(path, name)));
  }
  const name = path.split(sep).join('/');
  return EXCLUDE.some((re) => re.test(name)) ? [] : [name];
}

// Fixed timestamp (2026-01-01 00:00) so identical sources give identical zips.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const name of files) {
    const data = readFileSync(join(ROOT, name));
    const compressed = deflateRawSync(data, { level: 9 });
    const useDeflate = compressed.length < data.length;
    const body = useDeflate ? compressed : data;
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) {
  console.error(`Version mismatch: manifest.json is ${manifest.version}, package.json is ${pkg.version}.`);
  process.exit(1);
}

const files = INCLUDE.flatMap(collect);
const outDir = join(ROOT, 'dist');
const outFile = join(outDir, `${pkg.name}-${manifest.version}.zip`);
mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, buildZip(files));

console.log(`Packaged ${files.length} files:`);
for (const f of files) console.log(`  ${f}`);
console.log(`→ ${relative(ROOT, outFile)}`);
