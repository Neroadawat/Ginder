import axios from 'axios';
import {API_BASE_URL} from './config';

// Use a separate request so logout cannot trigger refresh or resurrect a login.
export async function revokeLogin(refreshToken: string | null): Promise<void> {
  if (refreshToken) {
    await axios.post(
      `${API_BASE_URL}/auth/logout`,
      {refresh_token: refreshToken},
      {timeout: 10000},
    );
  }
}
