'use client';

import clsx from 'clsx';
import * as React from 'react';
import { useState, useRef, useEffect, Suspense } from 'react';
import { ReadonlyURLSearchParams, useRouter, useSearchParams } from 'next/navigation';

import { Book } from '@/types/book';
import { AppService } from '@/types/system';
import { navigateToLogin, navigateToReader } from '@/utils/nav';
import { getBaseFilename, listFormater } from '@/utils/book';
import { eventDispatcher } from '@/utils/event';
import { ProgressPayload } from '@/utils/transfer';
import { throttle } from '@/utils/throttle';
import { parseOpenWithFiles } from '@/helpers/cli';
import { isTauriAppPlatform, hasUpdater, isWebAppPlatform, getApiBaseUrl } from '@/services/environment';
import { checkForAppUpdates } from '@/helpers/updater';
import { FILE_ACCEPT_FORMATS, SUPPORTED_FILE_EXTS } from '@/services/constants';

import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/useTheme';
import { useDemoBooks } from './hooks/useDemoBooks';
import { useBooksSync } from './hooks/useBooksSync';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { useOpenWithBooks } from '@/hooks/useOpenWithBooks';
import { tauriQuitApp } from '@/utils/window';

import { AboutWindow } from '@/components/AboutWindow';
import { Toast } from '@/components/Toast';
import Spinner from '@/components/Spinner';
import LibraryHeader from './components/LibraryHeader';
import Bookshelf from './components/Bookshelf';
import BookDetailModal from '@/components/BookDetailModal';
import useShortcuts from '@/hooks/useShortcuts';
import DropIndicator from '@/components/DropIndicator';

const LibraryPageWithSearchParams = () => {
  const searchParams = useSearchParams();
  return <LibraryPageContent searchParams={searchParams} />;
};

const LibraryPageContent = ({ searchParams }: { searchParams: ReadonlyURLSearchParams | null }) => {
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const { token, user } = useAuth();
  const {
    library: libraryBooks,
    updateBook,
    setLibrary,
    checkOpenWithBooks,
    setCheckOpenWithBooks,
  } = useLibraryStore();
  const _ = useTranslation();
  useTheme();
  const { updateAppTheme } = useThemeStore();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const isInitiating = useRef(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showDetailsBook, setShowDetailsBook] = useState<Book | null>(null);
  const [booksTransferProgress, setBooksTransferProgress] = useState<{
    [key: string]: number | null;
  }>({});
  const [isDragging, setIsDragging] = useState(false);
  const demoBooks = useDemoBooks();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useOpenWithBooks();

  const { pullLibrary, pushLibrary } = useBooksSync({
    onSyncStart: () => setLoading(true),
    onSyncEnd: () => setLoading(false),
  });

  usePullToRefresh(containerRef, pullLibrary);
  useScreenWakeLock(settings.screenWakeLock);

  useShortcuts({
    onQuitApp: async () => {
      if (isTauriAppPlatform()) {
        await tauriQuitApp();
      }
    },
  });

  useEffect(() => {
    updateAppTheme('base-200');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const doCheckAppUpdates = async () => {
      if (hasUpdater() && settings.autoCheckUpdates) {
        await checkForAppUpdates(_);
      }
    };
    doCheckAppUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const handleDropedFiles = async (files: File[] | string[]) => {
    if (files.length === 0) return;
    const supportedFiles = files.filter((file) => {
      let fileExt;
      if (typeof file === 'string') {
        fileExt = file.split('.').pop()?.toLowerCase();
      } else {
        fileExt = file.name.split('.').pop()?.toLowerCase();
      }
      return FILE_ACCEPT_FORMATS.includes(`.${fileExt}`);
    });
    if (supportedFiles.length === 0) {
      eventDispatcher.dispatch('toast', {
        message: _('No supported files found. Supported formats: {{formats}}', {
          formats: FILE_ACCEPT_FORMATS,
        }),
        type: 'error',
      });
      return;
    }

    if (appService?.hasHaptics) {
      const { impactFeedback } = await import('@tauri-apps/plugin-haptics');
      await impactFeedback('medium');
    }

    await importBooks(supportedFiles);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement> | DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement> | DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement> | DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const files = Array.from(event.dataTransfer.files);
      handleDropedFiles(files);
    }
  };

  useEffect(() => {
    const libraryPage = document.querySelector('.library-page');
    libraryPage?.addEventListener('dragover', handleDragOver as unknown as EventListener);
    libraryPage?.addEventListener('dragleave', handleDragLeave as unknown as EventListener);
    libraryPage?.addEventListener('drop', handleDrop as unknown as EventListener);

    const setupTauriDragDrop = async () => {
      if (!isTauriAppPlatform()) return null;
      
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const webview = await getCurrentWebview();
        
        const unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === 'over') {
            setIsDragging(true);
          } else if (event.payload.type === 'drop') {
            setIsDragging(false);
            handleDropedFiles(event.payload.paths);
          } else {
            setIsDragging(false);
          }
        });
        
        return () => {
          unlisten();
        };
      } catch (error) {
        console.warn('Failed to setup Tauri drag and drop:', error);
        return null;
      }
    };

    let tauriCleanup: (() => void) | null = null;
    setupTauriDragDrop().then((cleanup) => {
      tauriCleanup = cleanup;
    });

    return () => {
      libraryPage?.removeEventListener('dragover', handleDragOver as unknown as EventListener);
      libraryPage?.removeEventListener('dragleave', handleDragLeave as unknown as EventListener);
      libraryPage?.removeEventListener('drop', handleDrop as unknown as EventListener);
      if (tauriCleanup) {
        tauriCleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageRef.current]);

  const processOpenWithFiles = React.useCallback(
    async (appService: AppService, openWithFiles: string[], libraryBooks: Book[]) => {
      const settings = await appService.loadSettings();
      const bookIds: string[] = [];
      for (const file of openWithFiles) {
        console.log('Open with book:', file);
        try {
          const temp = !settings.autoImportBooksOnOpen;
          const book = await appService.importBook(file, libraryBooks, true, true, false, temp);
          if (book) {
            bookIds.push(book.hash);
          }
        } catch (error) {
          console.log('Failed to import book:', file, error);
        }
      }
      setLibrary(libraryBooks);
      appService.saveLibraryBooks(libraryBooks);

      console.log('Opening books:', bookIds);
      if (bookIds.length > 0) {
        setTimeout(() => {
          navigateToReader(router, bookIds);
        }, 0);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    const initLogin = async () => {
      const appService = await envConfig.getAppService();
      const settings = await appService.loadSettings();
      if (token && user) {
        if (!settings.keepLogin) {
          settings.keepLogin = true;
          setSettings(settings);
          saveSettings(envConfig, settings);
        }
      } else if (settings.keepLogin) {
        router.push('/auth');
      }
    };

    const loadingTimeout = setTimeout(() => setLoading(true), 300);
    const initLibrary = async () => {
      const appService = await envConfig.getAppService();
      const settings = await appService.loadSettings();
      setSettings(settings);

      const libraryBooks = await appService.loadLibraryBooks();
      if (checkOpenWithBooks && isTauriAppPlatform()) {
        await handleOpenWithBooks(appService, libraryBooks);
      } else {
        setCheckOpenWithBooks(false);
        setLibrary(libraryBooks);
      }

      setLibraryLoaded(true);
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    };

    const handleOpenWithBooks = async (appService: AppService, libraryBooks: Book[]) => {
      const openWithFiles = (await parseOpenWithFiles()) || [];

      if (openWithFiles.length > 0) {
        await processOpenWithFiles(appService, openWithFiles, libraryBooks);
      } else {
        setCheckOpenWithBooks(false);
        setLibrary(libraryBooks);
      }
    };

    initLogin();
    initLibrary();
    return () => {
      setCheckOpenWithBooks(false);
      isInitiating.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (demoBooks.length > 0 && libraryLoaded) {
      const newLibrary = [...libraryBooks];
      for (const book of demoBooks) {
        const idx = newLibrary.findIndex((b) => b.hash === book.hash);
        if (idx === -1) {
          newLibrary.push(book);
        } else {
          newLibrary[idx] = book;
        }
      }
      setLibrary(newLibrary);
      appService?.saveLibraryBooks(newLibrary);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoBooks, libraryLoaded]);

  const importBooks = async (files: (string | File)[]) => {
    setLoading(true);
    const failedFiles = [];
    const errorMap: [string, string][] = [
      ['No chapters detected.', _('No chapters detected.')],
      ['Failed to parse EPUB.', _('Failed to parse the EPUB file.')],
      ['Unsupported format.', _('This book format is not supported.')],
    ];
    for (const file of files) {
      try {
        const book = await appService?.importBook(file, libraryBooks);
        setLibrary(libraryBooks);
        
        // Only attempt auto-upload when online, authenticated, and configured for upload
        if (user && book && !book.uploadedAt && settings.autoUpload) {
          // Skip auto-upload in offline mode
          if (isWebAppPlatform() && !window.navigator.onLine) {
            console.log('Offline mode, skipping auto-upload for book:', book.title);
            continue;
          }
          
          // Skip auto-upload if API URL isn't configured
          const apiBaseUrl = getApiBaseUrl();
          if (!apiBaseUrl) {
            console.log('API URL not configured, skipping auto-upload for book:', book.title);
            continue;
          }
          
          console.log('Uploading book:', book.title);
          handleBookUpload(book);
        }
      } catch (error) {
        const filename = typeof file === 'string' ? file : file.name;
        const baseFilename = getBaseFilename(filename);
        failedFiles.push(baseFilename);
        const errorMessage =
          error instanceof Error
            ? errorMap.find(([substring]) => error.message.includes(substring))?.[1] || ''
            : '';
        eventDispatcher.dispatch('toast', {
          message:
            _('Failed to import book(s): {{filenames}}', {
              filenames: listFormater(false).format(failedFiles),
            }) + (errorMessage ? `\n${errorMessage}` : ''),
          type: 'error',
        });
        console.error('Failed to import book:', filename, error);
      }
    }
    appService?.saveLibraryBooks(libraryBooks);
    setLoading(false);
  };

  const selectFilesTauri = async () => {
    return appService?.selectFiles('Select Books', SUPPORTED_FILE_EXTS);
  };

  const selectFilesWeb = () => {
    return new Promise((resolve) => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = FILE_ACCEPT_FORMATS;
      fileInput.multiple = true;
      fileInput.click();

      fileInput.onchange = () => {
        resolve(fileInput.files);
      };
    });
  };

  const updateBookTransferProgress = throttle((bookHash: string, progress: ProgressPayload) => {
    if (progress.total === 0) return;
    const progressPct = (progress.progress / progress.total) * 100;
    setBooksTransferProgress((prev) => ({
      ...prev,
      [bookHash]: progressPct,
    }));
  }, 500);

  const handleBookUpload = async (book: Book) => {
    // Skip uploads in web mode if offline
    if (typeof window !== 'undefined' && isWebAppPlatform() && !window.navigator.onLine) {
      console.log('App is offline, skipping book upload');
      eventDispatcher.dispatch('toast', {
        type: 'warning',
        message: _('Cannot upload in offline mode. Connect to the internet and try again.'),
      });
      return false;
    }
    
    // Skip upload in web version if env doesn't have API URL configured
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      console.log('API URL not configured, skipping book upload');
      eventDispatcher.dispatch('toast', {
        type: 'warning',
        message: _('Book upload is not available in this environment.'),
      });
      return false;
    }
    
    // Skip upload if not authenticated
    try {
      const { getUserID } = await import('@/utils/access');
      const userId = await getUserID();
      if (!userId) {
        console.log('Not authenticated, skipping book upload');
        eventDispatcher.dispatch('toast', {
          type: 'warning',
          message: _('You need to be logged in to upload books.'),
        });
        return false;
      }
    } catch (error) {
      console.log('Error checking authentication, skipping book upload', error);
      eventDispatcher.dispatch('toast', {
        type: 'error',
        message: _('Failed to upload book: {{title}}', { title: book.title }),
      });
      return false;
    }
    
    try {
      await appService?.uploadBook(book, (progress) => {
        updateBookTransferProgress(book.hash, progress);
      });
      await updateBook(envConfig, book);
      pushLibrary();
      eventDispatcher.dispatch('toast', {
        type: 'info',
        timeout: 2000,
        message: _('Book uploaded: {{title}}', {
          title: book.title,
        }),
      });
      return true;
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Not authenticated') && settings.keepLogin) {
          settings.keepLogin = false;
          setSettings(settings);
          navigateToLogin(router);
          return false;
        } else if (err.message.includes('Insufficient storage quota')) {
          eventDispatcher.dispatch('toast', {
            type: 'error',
            message: _('Insufficient storage quota'),
          });
          return false;
        } else if (err.message.includes('Offline mode') || err.message.includes('Network error')) {
          eventDispatcher.dispatch('toast', {
            type: 'warning',
            message: _('Cannot upload in offline mode. Connect to the internet and try again.'),
          });
          return false;
        } else if (err.message.includes('API unavailable') || err.message.includes('Invalid API URL')) {
          eventDispatcher.dispatch('toast', {
            type: 'warning',
            message: _('Upload service is currently unavailable.'),
          });
          return false;
        }
      }
      eventDispatcher.dispatch('toast', {
        type: 'error',
        message: _('Failed to upload book: {{title}}', {
          title: book.title,
        }),
      });
      return false;
    }
  };

  const handleBookDownload = async (book: Book) => {
    try {
      await appService?.downloadBook(book, false, (progress) => {
        updateBookTransferProgress(book.hash, progress);
      });
      await updateBook(envConfig, book);
      eventDispatcher.dispatch('toast', {
        type: 'info',
        timeout: 2000,
        message: _('Book downloaded: {{title}}', {
          title: book.title,
        }),
      });
      return true;
    } catch {
      eventDispatcher.dispatch('toast', {
        message: _('Failed to download book: {{title}}', {
          title: book.title,
        }),
        type: 'error',
      });
      return false;
    }
  };

  const handleBookDelete = async (book: Book) => {
    try {
      await appService?.deleteBook(book, !!book.uploadedAt);
      await updateBook(envConfig, book);
      pushLibrary();
      eventDispatcher.dispatch('toast', {
        type: 'info',
        timeout: 2000,
        message: _('Book deleted: {{title}}', {
          title: book.title,
        }),
      });
      return true;
    } catch {
      eventDispatcher.dispatch('toast', {
        message: _('Failed to delete book: {{title}}', {
          title: book.title,
        }),
        type: 'error',
      });
      return false;
    }
  };

  const handleImportBooks = async () => {
    setIsSelectMode(false);
    console.log('Importing books...');
    let files;

    if (isTauriAppPlatform()) {
      if (appService?.isMobile) {
        files = (await selectFilesWeb()) as [File];
      } else {
        files = (await selectFilesTauri()) as [string];
      }
    } else {
      files = (await selectFilesWeb()) as [File];
    }
    importBooks(files);
  };

  const handleToggleSelectMode = () => {
    if (!isSelectMode && appService?.hasHaptics) {
      import('@tauri-apps/plugin-haptics').then(({ impactFeedback }) => {
        impactFeedback('medium');
      });
    }
    setIsSelectMode(!isSelectMode);
  };

  const handleSetSelectMode = (selectMode: boolean) => {
    if (selectMode && appService?.hasHaptics) {
      import('@tauri-apps/plugin-haptics').then(({ impactFeedback }) => {
        impactFeedback('medium');
      });
    }
    setIsSelectMode(selectMode);
  };

  const handleShowDetailsBook = (book: Book) => {
    setShowDetailsBook(book);
  };

  if (!appService) {
    return null;
  }

  if (checkOpenWithBooks) {
    return (
      loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )
    );
  }

  return (
    <div
      ref={pageRef}
      className={clsx(
        'library-page bg-base-200 text-base-content flex select-none flex-col overflow-hidden',
        appService?.isIOSApp ? 'h-[100vh]' : 'h-dvh',
        appService?.hasRoundedWindow && 'rounded-window',
      )}
    >
      <div className='fixed top-0 z-40 w-full'>
        <LibraryHeader
          isSelectMode={isSelectMode}
          onImportBooks={handleImportBooks}
          onToggleSelectMode={handleToggleSelectMode}
        />
      </div>
      {loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )}
      {libraryLoaded &&
        (libraryBooks.some((book) => !book.deletedAt) ? (
          <div
            ref={containerRef}
            className={clsx(
              'scroll-container drop-zone mt-[48px] flex-grow overflow-y-auto px-4 sm:px-2',
              appService?.hasSafeAreaInset && 'mt-[calc(52px+env(safe-area-inset-top))]',
              appService?.hasSafeAreaInset && 'pb-[calc(env(safe-area-inset-bottom))]',
              isDragging && 'drag-over',
            )}
          >
            <DropIndicator />
            <Bookshelf
              libraryBooks={libraryBooks}
              isSelectMode={isSelectMode}
              handleImportBooks={handleImportBooks}
              handleBookUpload={handleBookUpload}
              handleBookDownload={handleBookDownload}
              handleBookDelete={handleBookDelete}
              handleSetSelectMode={handleSetSelectMode}
              handleShowDetailsBook={handleShowDetailsBook}
              booksTransferProgress={booksTransferProgress}
            />
          </div>
        ) : (
          <div className='hero drop-zone h-screen items-center justify-center'>
            <DropIndicator />
            <div className='hero-content text-neutral-content text-center'>
              <div className='max-w-md'>
                <h1 className='mb-5 text-5xl font-bold'>{_('Your Library')}</h1>
                <p className='mb-5'>
                  {_(
                    'Welcome to your library. You can import your books here and read them anytime.',
                  )}
                </p>
                <button className='btn btn-primary rounded-xl' onClick={handleImportBooks}>
                  {_('Import Books')}
                </button>
              </div>
            </div>
          </div>
        ))}
      {showDetailsBook && (
        <BookDetailModal
          isOpen={!!showDetailsBook}
          book={showDetailsBook}
          onClose={() => setShowDetailsBook(null)}
        />
      )}
      <AboutWindow />
      <Toast />
    </div>
  );
};

const LibraryPage = () => {
  return (
    <Suspense
      fallback={
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      }
    >
      <LibraryPageWithSearchParams />
    </Suspense>
  );
};

export default LibraryPage;
