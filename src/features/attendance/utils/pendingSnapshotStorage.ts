/**
 * مخزن محلي مستمر ومحمي لحفظ لقطات الحضور المعلقة في حال انقطاع الشبكة
 * Persistent IndexedDB Storage for Attendance Snapshots Queue
 */

const DB_NAME = 'inftele_attendance_storage';
const DB_VERSION = 1;
const STORE_NAME = 'pending_snapshots';

export interface PendingSnapshotItem {
  id: string; // punchId or timestamp uuid
  userId: string;
  base64Data: string;
  timestamp: string;
  punchTimeText?: string;
  locationText?: string;
  attempts: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported on this platform'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      // محاولة طلب التخزين الدائم من المتصفح لمنع مسح البيانات تلقائياً
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
};

export const savePendingSnapshot = async (item: PendingSnapshotItem): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[PendingSnapshotStorage] Failed to save pending snapshot:', err);
  }
};

export const getPendingSnapshots = async (): Promise<PendingSnapshotItem[]> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[PendingSnapshotStorage] Failed to get pending snapshots:', err);
    return [];
  }
};

export const removePendingSnapshot = async (id: string): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[PendingSnapshotStorage] Failed to remove pending snapshot:', err);
  }
};
