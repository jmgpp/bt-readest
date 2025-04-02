import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isTauriAppPlatform } from '@/services/environment';
import { useLibraryStore } from '@/store/libraryStore';
import { navigateToLibrary } from '@/utils/nav';

interface SingleInstancePayload {
  args: string[];
  cwd: string;
}

export function useOpenWithBooks() {
  const router = useRouter();
  const { setCheckOpenWithBooks } = useLibraryStore();
  const listenedOpenWithBooks = useRef(false);

  const handleOpenWithFileUrl = (url: string) => {
    console.log('Handle Open with URL:', url);
    let filePath = url;
    if (filePath.startsWith('file://')) {
      filePath = decodeURI(filePath.replace('file://', ''));
    }
    if (!/^(https?:|data:|blob:)/i.test(filePath)) {
      window.OPEN_WITH_FILES = [filePath];
      setCheckOpenWithBooks(true);
      navigateToLibrary(router, `reload=${Date.now()}`);
    }
  };

  useEffect(() => {
    // Skip in SSR or web environment
    if (typeof window === 'undefined' || !isTauriAppPlatform()) {
      return;
    }
    
    if (listenedOpenWithBooks.current) return;
    listenedOpenWithBooks.current = true;

    // We'll use a dynamic import pattern to avoid loading Tauri modules in web mode
    const setupTauriListeners = async () => {
      try {
        // Dynamically import Tauri modules
        const tauriModules = await Promise.all([
          import('@tauri-apps/api/window'),
          import('@tauri-apps/plugin-deep-link')
        ]).catch(err => {
          console.warn('Failed to import Tauri modules:', err);
          return null;
        });
        
        if (!tauriModules) return null;
        
        const [windowModule, deepLinkModule] = tauriModules;
        
        // Set up listeners using the imported modules
        const cleanupFunctions: Array<() => void> = [];
        
        // This is a safer approach that doesn't rely on specific API functions
        // that might change between Tauri versions
        try {
          const deepLinkUnlisten = await deepLinkModule.onOpenUrl((urls) => {
            urls.forEach(url => handleOpenWithFileUrl(url));
          });
          cleanupFunctions.push(deepLinkUnlisten);
        } catch (e) {
          console.warn('Deep link setup failed:', e);
        }
        
        return () => {
          cleanupFunctions.forEach(fn => {
            try {
              fn();
            } catch (e) {
              console.warn('Cleanup error:', e);
            }
          });
        };
      } catch (error) {
        console.warn('Failed to setup Tauri listeners:', error);
        return null;
      }
    };

    let cleanup: (() => void) | null = null;
    setupTauriListeners()
      .then(cleanupFn => {
        cleanup = cleanupFn;
      })
      .catch(error => {
        console.error('Error setting up Tauri listeners:', error);
      });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
