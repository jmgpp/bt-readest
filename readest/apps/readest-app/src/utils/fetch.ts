import { getAccessToken } from './access';
import { isWebAppPlatform } from '@/services/environment';

export const fetchWithAuth = async (url: string, options: RequestInit) => {
  // Skip in offline mode for web app
  if (typeof window !== 'undefined' && isWebAppPlatform() && !window.navigator.onLine) {
    console.log('App is offline, skipping API call');
    throw new Error('Offline mode - API unavailable');
  }

  // Check for invalid URL (happens when API endpoints are null)
  if (!url || url.includes('null')) {
    console.warn('Invalid API URL:', url);
    throw new Error('Invalid API URL');
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      console.error('Error:', errorData.error || response.statusText);
      throw new Error(errorData.error || 'Request failed');
    }

    return response;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network error - API might be unavailable');
      throw new Error('Network error - API unavailable');
    }
    throw error;
  }
};
