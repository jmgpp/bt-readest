import { Book, BookConfig, BookNote, BookDataRecord } from '@/types/book';
import { getApiBaseUrl } from '@/services/environment';
import { getAccessToken } from '@/utils/access';

// Use a function to get the API endpoint to handle dynamic changes
const getSyncApiEndpoint = () => {
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}/sync` : null;
};

export type SyncType = 'books' | 'configs' | 'notes';
export type SyncOp = 'push' | 'pull' | 'both';

interface BookRecord extends BookDataRecord, Book {}
interface BookConfigRecord extends BookDataRecord, BookConfig {}
interface BookNoteRecord extends BookDataRecord, BookNote {}

export interface SyncResult {
  books: BookRecord[] | null;
  notes: BookNoteRecord[] | null;
  configs: BookConfigRecord[] | null;
}

export interface SyncData {
  books?: Partial<BookRecord>[];
  notes?: Partial<BookNoteRecord>[];
  configs?: Partial<BookConfigRecord>[];
}

export class SyncClient {
  /**
   * Pull incremental changes since a given timestamp (in ms).
   * Returns updated or deleted records since that time.
   */
  async pullChanges(since: number, type?: SyncType, book?: string): Promise<SyncResult> {
    const token = await getAccessToken();
    if (!token) {
      console.log('Not authenticated - skipping sync');
      return { books: null, notes: null, configs: null };
    }

    const endpoint = getSyncApiEndpoint();
    if (!endpoint) {
      console.log('Offline mode - sync unavailable');
      return { books: null, notes: null, configs: null };
    }

    const url = `${endpoint}?since=${encodeURIComponent(since)}&type=${type ?? ''}&book=${book ?? ''}`;
    
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to pull changes: ${error.error || res.statusText}`);
      }

      return res.json();
    } catch (error) {
      if (error instanceof Error) {
        // Handle fetch network errors
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.log('Network error during sync - API might be unavailable');
          return { books: null, notes: null, configs: null };
        }
        throw error;
      }
      throw new Error('Unknown error during sync');
    }
  }

  /**
   * Push local changes to the server.
   * Uses last-writer-wins logic as implemented on the server side.
   */
  async pushChanges(payload: SyncData): Promise<SyncResult> {
    const token = await getAccessToken();
    if (!token) {
      console.log('Not authenticated - skipping sync');
      return { books: null, notes: null, configs: null };
    }

    const endpoint = getSyncApiEndpoint();
    if (!endpoint) {
      console.log('Offline mode - sync unavailable');
      return { books: null, notes: null, configs: null };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to push changes: ${error.error || res.statusText}`);
      }

      return res.json();
    } catch (error) {
      if (error instanceof Error) {
        // Handle fetch network errors
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.log('Network error during sync - API might be unavailable');
          return { books: null, notes: null, configs: null };
        }
        throw error;
      }
      throw new Error('Unknown error during sync');
    }
  }
}
