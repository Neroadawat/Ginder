const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const frontendDir = path.resolve(__dirname, '..');
const envPath = path.join(frontendDir, '.env.appetize');

if (!fs.existsSync(envPath)) {
  console.error(
    'Missing frontend/.env.appetize. Copy .env.appetize.example, then set your public HTTPS/WSS backend URLs.',
  );
  process.exit(1);
}

const values = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const separator = line.indexOf('=');
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim(),
      ];
    }),
);

const apiUrl = values.API_BASE_URL || '';
const wsUrl = values.WS_BASE_URL || '';
const invalid =
  !apiUrl.startsWith('https://') ||
  !apiUrl.endsWith('/api/v1') ||
  !wsUrl.startsWith('wss://') ||
  !wsUrl.endsWith('/ws') ||
  apiUrl.includes('YOUR-PUBLIC-HOST') ||
  wsUrl.includes('YOUR-PUBLIC-HOST');

if (invalid) {
  console.error(
    'Invalid .env.appetize: API_BASE_URL must be https://.../api/v1 and WS_BASE_URL must be wss://.../ws.',
  );
  process.exit(1);
}

const bundleRoot = path.join(
  frontendDir,
  'android',
  'app',
  'build',
  'generated',
  'appetizeBundle',
);
const bundleAssets = path.join(bundleRoot, 'assets');
const bundleResources = path.join(bundleRoot, 'res');
fs.rmSync(bundleRoot, {recursive: true, force: true});
fs.mkdirSync(bundleAssets, {recursive: true});
fs.mkdirSync(bundleResources, {recursive: true});

const cliPath = path.join(
  frontendDir,
  'node_modules',
  'react-native',
  'cli.js',
);
const bundleResult = spawnSync(
  process.execPath,
  [
    cliPath,
    'bundle',
    '--platform',
    'android',
    '--dev',
    'false',
    '--entry-file',
    'index.js',
    '--bundle-output',
    path.join(bundleAssets, 'index.android.bundle'),
    '--assets-dest',
    bundleResources,
  ],
  {cwd: frontendDir, stdio: 'inherit'},
);

if (bundleResult.error) {
  console.error(bundleResult.error.message);
  process.exit(1);
}
if (bundleResult.status !== 0) {
  process.exit(bundleResult.status ?? 1);
}

let buildRoot = frontendDir;
let temporaryDrive = null;

// React Native's generated C++ object names are very long. Ninja on Windows
// still enforces a 260-character filename limit, even when long paths are
// enabled system-wide. A temporary drive mapping keeps the build path short
// without moving the checkout or changing Android Studio's project location.
if (process.platform === 'win32') {
  temporaryDrive = 'ZYXWVUTSRQPONMLKJIHGFED'.split('').find(letter => {
    const drive = `${letter}:`;
    if (fs.existsSync(`${drive}\\`)) {
      return false;
    }
    const mapped = spawnSync('subst', [drive, frontendDir], {stdio: 'ignore'});
    return mapped.status === 0;
  });

  if (!temporaryDrive) {
    console.error(
      'Could not create a temporary drive for the Android build. Free a drive letter or move the repository to a shorter path.',
    );
    process.exit(1);
  }
  buildRoot = `${temporaryDrive}:\\`;
}

const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
let result;
try {
  result = spawnSync(wrapper, ['assembleAppetize', '--no-daemon'], {
    cwd: path.join(buildRoot, 'android'),
    env: {
      ...process.env,
      // Autolinking reports dependency sources on their original drive. Keep
      // the codegen CLI there too so Node never compares paths across drives.
      GINDER_CODEGEN_DIR: path.join(
        frontendDir,
        'node_modules',
        '@react-native',
        'codegen',
      ),
      GINDER_REACT_NATIVE_DIR: path.join(
        frontendDir,
        'node_modules',
        'react-native',
      ),
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
} finally {
  if (temporaryDrive) {
    spawnSync('subst', [`${temporaryDrive}:`, '/d'], {stdio: 'ignore'});
  }
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  '\nAppetize APK: android/app/build/outputs/apk/appetize/app-appetize.apk',
);
