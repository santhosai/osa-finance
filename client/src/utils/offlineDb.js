// IndexedDB wrapper for offline storage and sync

const DB_NAME = 'osmFinanceOffline';
const DB_VERSION = 1;

const STORES = {
  CUSTOMERS: 'customers',
  LOANS: 'loans',
  PAYMENTS: 'payments',
  PENDING_SYNC: 'pendingSync'
};

let db = null;

// Initialize IndexedDB
export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Customers store
      if (!database.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const customersStore = database.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
        customersStore.createIndex('phone', 'phone', { unique: false });
      }

      // Loans store
      if (!database.objectStoreNames.contains(STORES.LOANS)) {
        const loansStore = database.createObjectStore(STORES.LOANS, { keyPath: 'id' });
        loansStore.createIndex('customer_id', 'customer_id', { unique: false });
        loansStore.createIndex('status', 'status', { unique: false });
      }

      // Payments store
      if (!database.objectStoreNames.contains(STORES.PAYMENTS)) {
        const paymentsStore = database.createObjectStore(STORES.PAYMENTS, { keyPath: 'id' });
        paymentsStore.createIndex('loan_id', 'loan_id', { unique: false });
        paymentsStore.createIndex('payment_date', 'payment_date', { unique: false });
      }

      // Pending sync store for offline actions
      if (!database.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        const syncStore = database.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('type', 'type', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// Generic store operations
const getStore = async (storeName, mode = 'readonly') => {
  const database = await initDB();
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
};

// Save data to store
export const saveToStore = async (storeName, data) => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Get all from store
export const getAllFromStore = async (storeName) => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Get by ID
export const getById = async (storeName, id) => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Delete from store
export const deleteFromStore = async (storeName, id) => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Bulk save
export const bulkSave = async (storeName, items) => {
  const store = await getStore(storeName, 'readwrite');
  const promises = items.map(item => {
    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
  return Promise.all(promises);
};

// Clear store
export const clearStore = async (storeName) => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Add pending sync action
export const addPendingSync = async (action) => {
  const syncData = {
    ...action,
    timestamp: Date.now()
  };
  return saveToStore(STORES.PENDING_SYNC, syncData);
};

// Get pending sync actions
export const getPendingSync = async () => {
  return getAllFromStore(STORES.PENDING_SYNC);
};

// Clear pending sync after successful sync
export const clearPendingSync = async () => {
  return clearStore(STORES.PENDING_SYNC);
};

// Delete specific pending sync
export const deletePendingSync = async (id) => {
  return deleteFromStore(STORES.PENDING_SYNC, id);
};

// Cache API response for offline use
export const cacheApiResponse = async (endpoint, data) => {
  try {
    // Cache different data types
    if (endpoint.includes('daily-customers')) {
      await clearStore(STORES.CUSTOMERS);
      if (Array.isArray(data)) {
        await bulkSave(STORES.CUSTOMERS, data);
      }
    } else if (endpoint.includes('daily-loans')) {
      if (Array.isArray(data)) {
        await bulkSave(STORES.LOANS, data);
      } else if (data.id) {
        await saveToStore(STORES.LOANS, data);
      }
    } else if (endpoint.includes('daily-payments')) {
      if (Array.isArray(data)) {
        await bulkSave(STORES.PAYMENTS, data);
      } else if (data.id) {
        await saveToStore(STORES.PAYMENTS, data);
      }
    }
  } catch (error) {
    console.error('Error caching API response:', error);
  }
};

// Get cached data when offline
export const getCachedData = async (endpoint) => {
  try {
    if (endpoint.includes('daily-customers')) {
      return getAllFromStore(STORES.CUSTOMERS);
    } else if (endpoint.includes('daily-loans')) {
      return getAllFromStore(STORES.LOANS);
    } else if (endpoint.includes('daily-payments')) {
      return getAllFromStore(STORES.PAYMENTS);
    }
    return null;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
};

// Sync pending actions when online
export const syncPendingActions = async (apiUrl) => {
  const pendingActions = await getPendingSync();

  if (pendingActions.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const action of pendingActions) {
    try {
      const response = await fetch(`${apiUrl}${action.endpoint}`, {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.data)
      });

      if (response.ok) {
        await deletePendingSync(action.id);
        synced++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error('Sync error:', error);
      failed++;
    }
  }

  return { synced, failed };
};

// Check if there are pending sync actions
export const hasPendingSync = async () => {
  const pending = await getPendingSync();
  return pending.length > 0;
};

// Export store names
export { STORES };
