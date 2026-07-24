import AsyncStorage from '@react-native-async-storage/async-storage';


const TOKEN_KEY = 'shield_auth_token';
const DEVICE_ID_KEY = 'shield_device_id';
const API_BASE_KEY = 'shield_api_base';

/** Get the stored auth token. */
export async function getToken(): Promise<string | null> {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

/** Set the auth token. */
export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** Remove the auth token (and legacy keys). */
export async function clearToken(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(TOKEN_KEY),
    AsyncStorage.removeItem('shieldpay_session')
  ]);
}

/** Get-or-create a stable device identifier. */
export async function getDeviceId(): Promise<string> {
  let stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!stored) {
    // Generate a simple UUID v4 without relying on native crypto modules
    stored = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    await AsyncStorage.setItem(DEVICE_ID_KEY, stored);
  }
  return stored;
}

/** 
 * Gets the override API base URL from storage, if any.
 * This is primarily for debugging or pointing to local dev servers without rebuilding.
 */
export async function getOverrideApiBase(): Promise<string | null> {
  return await AsyncStorage.getItem(API_BASE_KEY);
}

/** 
 * Sets an override API base URL.
 */
export async function setOverrideApiBase(url: string): Promise<void> {
  if (url.trim()) {
    await AsyncStorage.setItem(API_BASE_KEY, url.trim());
  } else {
    await AsyncStorage.removeItem(API_BASE_KEY);
  }
}
