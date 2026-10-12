/**
 * App configuration — reads from .env via react-native-config.
 *
 * Falls back to Android emulator defaults if .env is missing.
 * Note: 10.0.2.2 is the special IP that Android Emulator uses to reach
 * the host machine's localhost (using "localhost" would target the emulator itself).
 */

import Config from 'react-native-config';

export const API_BASE_URL =
  Config.API_BASE_URL || 'http://10.0.2.2:8000/api/v1';
export const WS_BASE_URL = Config.WS_BASE_URL || 'ws://10.0.2.2:8000/ws';
export const DEEP_LINK_PREFIX = Config.DEEP_LINK_PREFIX || 'ginder://';
export const FCM_ENABLED = Config.FCM_ENABLED === 'true';
const publicOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
export const PRIVACY_POLICY_URL =
  Config.PRIVACY_POLICY_URL || `${publicOrigin}/privacy`;
export const TERMS_OF_SERVICE_URL =
  Config.TERMS_OF_SERVICE_URL || `${publicOrigin}/terms`;
