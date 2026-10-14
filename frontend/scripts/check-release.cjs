// Validate release inputs without printing secret values.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const errors = [];
const envPath = path.join(root, '.env.production');
if (!fs.existsSync(envPath)) {
  console.error('Missing frontend/.env.production');
  process.exit(1);
}
const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_]+\s*=/.test(line)).map(line => {
    const index = line.indexOf('=');
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
  }));
for (const key of ['API_BASE_URL', 'WS_BASE_URL', 'PRIVACY_POLICY_URL', 'TERMS_OF_SERVICE_URL']) {
  try {
    const url = new URL(env[key]);
    if (url.protocol !== (key === 'WS_BASE_URL' ? 'wss:' : 'https:') ||
        /(^|\.)(example\.(com|org|net)|localhost|invalid)$/.test(url.hostname) ||
        ['10.0.2.2', '127.0.0.1'].includes(url.hostname) || url.username || url.password) {
      errors.push(`${key} must use a real public secure URL`);
    }
  } catch {errors.push(`${key} is missing or invalid`);}
}
if (!fs.existsSync(path.join(root, 'android/keystore.properties'))) {
  errors.push('Missing android/keystore.properties for release signing');
}
if (env.FCM_ENABLED === 'true') {
  const firebase = path.join(root, 'android/app/google-services.json');
  try {
    const data = JSON.parse(fs.readFileSync(firebase, 'utf8'));
    if (!data.client?.some(client => client.client_info?.android_client_info?.package_name === 'com.tamsoot.ginder')) {
      errors.push('Firebase config must contain package com.tamsoot.ginder');
    }
  } catch {errors.push('FCM_ENABLED requires valid android/app/google-services.json');}
}
if (errors.length) {
  errors.forEach(error => console.error(error));
  process.exitCode = 1;
} else {console.log('Release URLs, signing configuration and optional Firebase inputs passed.');}
