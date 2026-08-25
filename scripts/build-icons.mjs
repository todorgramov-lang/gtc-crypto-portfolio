/**
 * Генерира иконките на приложението от един SVG.
 *
 * Използва sharp от родителския проект (Корфу), за да не дублираме 30-мегабайтова
 * зависимост. Ако някога преместиш папката самостоятелно, инсталирай sharp тук:
 *   npm i -D sharp
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const iconsDir = resolve(projectRoot, 'public/icons');

const require = createRequire(import.meta.url);

function loadSharp() {
  const candidates = [
    'sharp',
    resolve(projectRoot, '../node_modules/sharp'),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // пробваме следващия
    }
  }

  throw new Error('sharp не е намерен. Инсталирай го с: npm i -D sharp');
}

const BACKGROUND = '#0B0F14';
const ACCENT = '#00C853';

/**
 * Иконката: тъмен квадрат, върху него възходяща линия и монограм — същият
 * „terminal" език като в приложението.
 */
const icon = (size, padding) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${padding > 0 ? 0 : 112}" fill="${BACKGROUND}"/>
  <g transform="translate(0, ${padding})">
    <polyline
      points="96,336 192,248 272,296 416,152"
      fill="none"
      stroke="${ACCENT}"
      stroke-width="34"
      stroke-linecap="round"
      stroke-linejoin="round"/>
    <circle cx="416" cy="152" r="30" fill="${ACCENT}"/>
  </g>
</svg>`;

const targets = [
  { name: 'icon-192.png', size: 192, padding: 0 },
  { name: 'icon-512.png', size: 512, padding: 0 },
  // Maskable иконките се изрязват в кръг — оставяме повече въздух.
  { name: 'icon-maskable-512.png', size: 512, padding: 40 },
  { name: 'apple-touch-icon.png', size: 180, padding: 0 },
  { name: 'favicon-32.png', size: 32, padding: 0 },
];

const sharp = loadSharp();
await mkdir(iconsDir, { recursive: true });

for (const target of targets) {
  const svg = Buffer.from(icon(target.size, target.padding));
  const png = await sharp(svg).resize(target.size, target.size).png().toBuffer();
  await writeFile(resolve(iconsDir, target.name), png);
  console.log(`✓ ${target.name} (${target.size}×${target.size})`);
}

console.log('\nГотово — иконките са в public/icons/');
