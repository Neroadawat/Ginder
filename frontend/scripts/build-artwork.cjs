// Deterministic original artwork: no external photos or network requests.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const categories = {
  Thai: '#8c3e40', Japanese: '#4f5479', Korean: '#99543f', Chinese: '#875367',
  Italian: '#477268', 'Fast Food': '#866236', Cafe: '#655043', Dessert: '#975c83',
  'Food Court': '#486e82', Steak: '#724a48', 'Hot Pot': '#9b583e', Indian: '#837234',
  Other: '#5a596b',
};
const plate = `<circle cx="300" cy="205" r="108" fill="#fff" opacity=".14"/>
<circle cx="300" cy="205" r="80" fill="none" stroke="#fff" stroke-width="7"/>
<circle cx="300" cy="205" r="60" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>
<path d="M155 130v150m-12-150v48q12 25 24 0v-48m278 0v150m0-150q-30 50 0 65" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`;
(async () => {
  const dir = path.join(root, 'src/assets/placeholders');
  fs.mkdirSync(dir, {recursive: true});
  for (const [category, color] of Object.entries(categories)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450">
    <rect width="600" height="450" fill="${color}"/>${plate}
    <text x="300" y="365" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="30">${category}</text></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(dir, category.toLowerCase().replace(/ /g, '-') + '.png'));
  }
  const output = path.join(root, 'android/play-store-assets');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <rect width="1024" height="500" fill="#181416"/>
  <circle cx="890" cy="50" r="230" fill="#a92946" opacity=".35"/>
  <circle cx="735" cy="470" r="270" fill="#ed6285" opacity=".14"/>
  <text x="75" y="180" fill="white" font-family="sans-serif" font-size="82" font-weight="bold">Ginder</text>
  <text x="78" y="246" fill="#eee" font-family="sans-serif" font-size="28">Find food. Choose together.</text>
  <text x="78" y="310" fill="#efa5b8" font-family="sans-serif" font-size="22">Nearby restaurants · Swipe · Friends</text>
  <g transform="translate(610 100) rotate(-8 140 150)"><rect width="270" height="310" rx="30" fill="#a92946"/>
  <g transform="translate(-100 -35) scale(.77)">${plate}</g>
  <path d="M117 245c-32-36-70 1 0 45 70-44 32-81 0-45" fill="white"/></g>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(output, 'feature-graphic-1024x500.png'));
  console.log('Created 13 category placeholders and the Play Store feature graphic.');
})().catch(error => {console.error(error.message); process.exitCode = 1;});
