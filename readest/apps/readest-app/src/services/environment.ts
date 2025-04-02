import { AppService } from '@/types/system';
import { READEST_WEB_BASE_URL as BOOKTALK_WEB_BASE_URL } from './constants';

declare global {
  interface Window {
    __BOOKTALK_CLI_ACCESS?: boolean;
    __BOOKTALK_UPDATER_ACCESS?: boolean;
  }
}

export const isTauriAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'tauri';
export const isWebAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'web';
export const hasUpdater = () =>
  window.__BOOKTALK_UPDATER_ACCESS === true && !process.env['NEXT_PUBLIC_DISABLE_UPDATER'];
export const hasCli = () => window.__BOOKTALK_CLI_ACCESS === true;
export const isPWA = () => window.matchMedia('(display-mode: standalone)').matches;

// Dev API only in development mode and web platform
// with command `pnpm dev-web`
// for production build or tauri app use the production Web API
export const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    // Server-side rendering, return a placeholder
    return '/api';
  }
  
  // Check if we're running in a web context without internet connection
  if (isWebAppPlatform() && !window.navigator.onLine) {
    // Return null when offline to prevent unnecessary fetch errors
    return null;
  }
  
  // Handle environment variable configuration
  if (process.env['NEXT_PUBLIC_API_BASE_URL']) {
    return process.env['NEXT_PUBLIC_API_BASE_URL'];
  }
  
  // Use fallback URL
  if (BOOKTALK_WEB_BASE_URL) {
    return `${BOOKTALK_WEB_BASE_URL}/api`;
  }
  
  // No valid API URL available
  console.warn('No valid API URL found. API features will be unavailable.');
  return null;
};

export interface EnvConfigType {
  getAppService: () => Promise<AppService>;
}

let nativeAppService: AppService | null = null;
const getNativeAppService = async () => {
  if (!nativeAppService) {
    const { NativeAppService } = await import('@/services/nativeAppService');
    nativeAppService = new NativeAppService();
    await nativeAppService.loadSettings();
  }
  return nativeAppService;
};

let webAppService: AppService | null = null;
const getWebAppService = async () => {
  if (!webAppService) {
    const { WebAppService } = await import('@/services/webAppService');
    webAppService = new WebAppService();
    await webAppService.loadSettings();
  }
  return webAppService;
};

const environmentConfig: EnvConfigType = {
  getAppService: async () => {
    if (isTauriAppPlatform()) {
      return getNativeAppService();
    } else {
      return getWebAppService();
    }
  },
};

export default environmentConfig;
