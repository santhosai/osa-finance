import { useState, useEffect, useCallback } from 'react';
import {
  initDB,
  cacheApiResponse,
  getCachedData,
  addPendingSync,
  syncPendingActions,
  hasPendingSync
} from '../utils/offlineDb';

// Hook to detect online/offline status
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// Hook for offline-aware API calls
export const useOfflineApi = (apiUrl) => {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize DB on mount
  useEffect(() => {
    initDB().catch(console.error);
    checkPendingSync();
  }, []);

  // Check for pending sync items
  const checkPendingSync = async () => {
    const hasPending = await hasPendingSync();
    if (hasPending) {
      const pending = await getCachedData('pending');
      setPendingCount(pending?.length || 0);
    } else {
      setPendingCount(0);
    }
  };

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncData();
    }
  }, [isOnline, pendingCount]);

  // Sync pending data
  const syncData = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await syncPendingActions(apiUrl);
      if (result.synced > 0) {
        alert(`Synced ${result.synced} offline actions!`);
      }
      if (result.failed > 0) {
        alert(`${result.failed} actions failed to sync`);
      }
      await checkPendingSync();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch with offline fallback
  const fetchWithOffline = useCallback(async (endpoint, options = {}) => {
    const url = `${apiUrl}${endpoint}`;

    if (isOnline) {
      try {
        const response = await fetch(url, options);
        const data = await response.json();

        // Cache successful GET responses
        if (!options.method || options.method === 'GET') {
          cacheApiResponse(endpoint, data);
        }

        return { data, fromCache: false, error: null };
      } catch (error) {
        console.log('Network error, falling back to cache');
        const cachedData = await getCachedData(endpoint);
        if (cachedData) {
          return { data: cachedData, fromCache: true, error: null };
        }
        return { data: null, fromCache: false, error };
      }
    } else {
      // Offline - return cached data
      const cachedData = await getCachedData(endpoint);
      return { data: cachedData || [], fromCache: true, error: null };
    }
  }, [apiUrl, isOnline]);

  // POST/PUT/DELETE with offline queue
  const mutateWithOffline = useCallback(async (endpoint, method, data) => {
    const url = `${apiUrl}${endpoint}`;

    if (isOnline) {
      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          const result = await response.json();
          return { success: true, data: result, queued: false };
        } else {
          const error = await response.json();
          return { success: false, error: error.error, queued: false };
        }
      } catch (error) {
        // Network error - queue for later
        await addPendingSync({ endpoint, method, data });
        await checkPendingSync();
        return { success: true, queued: true, message: 'Saved offline, will sync when online' };
      }
    } else {
      // Offline - queue for later
      await addPendingSync({ endpoint, method, data });
      await checkPendingSync();
      return { success: true, queued: true, message: 'Saved offline, will sync when online' };
    }
  }, [apiUrl, isOnline]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    fetchWithOffline,
    mutateWithOffline,
    syncData,
    checkPendingSync
  };
};

export default useOnlineStatus;
