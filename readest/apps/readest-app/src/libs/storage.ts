import { getApiBaseUrl, isWebAppPlatform } from '@/services/environment';
import { getUserID } from '@/utils/access';
import { fetchWithAuth } from '@/utils/fetch';
import {
  tauriUpload,
  tauriDownload,
  webUpload,
  webDownload,
  ProgressHandler,
  ProgressPayload,
} from '@/utils/transfer';

// Use a function to get API endpoints to handle dynamic changes
const getApiEndpoints = () => {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;
  
  return {
    upload: `${baseUrl}/storage/upload`,
    download: `${baseUrl}/storage/download`,
    delete: `${baseUrl}/storage/delete`,
  };
};

export const createProgressHandler = (
  totalFiles: number,
  completedFilesRef: { count: number },
  onProgress?: ProgressHandler,
) => {
  return (progress: ProgressPayload) => {
    const fileProgress = progress.progress / progress.total;
    const overallProgress = ((completedFilesRef.count + fileProgress) / totalFiles) * 100;

    if (onProgress) {
      onProgress({
        progress: overallProgress,
        total: 100,
        transferSpeed: progress.transferSpeed,
      });
    }
  };
};

export const uploadFile = async (
  file: File,
  fileFullPath: string,
  onProgress?: ProgressHandler,
  bookHash?: string,
) => {
  try {
    // Skip upload if we're in web mode and offline
    if (typeof window !== 'undefined' && isWebAppPlatform() && !window.navigator.onLine) {
      console.log('App is offline, skipping file upload');
      throw new Error('Offline mode - upload unavailable');
    }
    
    const endpoints = getApiEndpoints();
    if (!endpoints) {
      console.warn('API endpoints unavailable, skipping file upload');
      throw new Error('API endpoints unavailable');
    }
    
    const response = await fetchWithAuth(endpoints.upload, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        bookHash,
      }),
    });

    const { uploadUrl } = await response.json();
    if (isWebAppPlatform()) {
      await webUpload(file, uploadUrl, onProgress);
    } else {
      await tauriUpload(uploadUrl, fileFullPath, 'PUT', onProgress);
    }
  } catch (error) {
    console.error('File upload failed:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('File upload failed');
  }
};

export const downloadFile = async (
  filePath: string,
  fileFullPath: string,
  onProgress?: ProgressHandler,
) => {
  try {
    // Skip download if we're in web mode and offline
    if (typeof window !== 'undefined' && isWebAppPlatform() && !window.navigator.onLine) {
      console.log('App is offline, skipping file download');
      throw new Error('Offline mode - download unavailable');
    }
    
    const endpoints = getApiEndpoints();
    if (!endpoints) {
      console.warn('API endpoints unavailable, skipping file download');
      throw new Error('API endpoints unavailable');
    }
    
    const userId = await getUserID();
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const fileKey = `${userId}/${filePath}`;
    const response = await fetchWithAuth(
      `${endpoints.download}?fileKey=${encodeURIComponent(fileKey)}`,
      {
        method: 'GET',
      },
    );

    const { downloadUrl } = await response.json();

    if (isWebAppPlatform()) {
      return await webDownload(downloadUrl, onProgress);
    } else {
      await tauriDownload(downloadUrl, fileFullPath, onProgress);
      return;
    }
  } catch (error) {
    console.error('File download failed:', error);
    throw new Error('File download failed');
  }
};

export const deleteFile = async (filePath: string) => {
  try {
    // Skip deletion if we're in web mode and offline
    if (typeof window !== 'undefined' && isWebAppPlatform() && !window.navigator.onLine) {
      console.log('App is offline, skipping file deletion');
      throw new Error('Offline mode - deletion unavailable');
    }
    
    const endpoints = getApiEndpoints();
    if (!endpoints) {
      console.warn('API endpoints unavailable, skipping file deletion');
      throw new Error('API endpoints unavailable');
    }
    
    const userId = await getUserID();
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const fileKey = `${userId}/${filePath}`;
    await fetchWithAuth(`${endpoints.delete}?fileKey=${encodeURIComponent(fileKey)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('File deletion failed:', error);
    throw new Error('File deletion failed');
  }
};
