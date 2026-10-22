/**
 * خطاف للمزامنة الصامتة للقطات الحضور المعلقة في IndexedDB
 * Silent sync hook for attendance snapshots in background
 */

import { useEffect, useRef } from 'react';
import { getPendingSnapshots, removePendingSnapshot } from '../utils/pendingSnapshotStorage';
import { uploadSnapshot } from '../utils/snapshotStorage';

export const useSilentPhotoSync = () => {
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const runSync = async () => {
      if (isSyncingRef.current || !navigator.onLine) return;
      isSyncingRef.current = true;

      try {
        const pending = await getPendingSnapshots();
        if (!pending || pending.length === 0) {
          isSyncingRef.current = false;
          return;
        }

        // رفع بطيء ومتقطع لتفادي إجهاد السيرفر
        for (const item of pending) {
          // محاولة الرفع فقط إذا لم تتجاوز المحاولات 5
          if (item.attempts < 5) {
            const res = await uploadSnapshot(item.base64Data, `recovery_${item.userId}`);
            if (res.url) {
              await removePendingSnapshot(item.id);
            } else {
              item.attempts += 1;
            }
          } else {
            // حذف الصورة التالفة بعد 5 محاولات فاشلة لتنظيف المساحة
            await removePendingSnapshot(item.id);
          }
          // انتظار نصف ثانية بين كل رفعة
          await new Promise((r) => setTimeout(r, 600));
        }
      } catch (err) {
        console.warn('[SilentPhotoSync] Sync loop caught error:', err);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // تشغيل عند أول فتح، وعند استعادة اتصال الإنترنت
    runSync();
    window.addEventListener('online', runSync);

    return () => {
      window.removeEventListener('online', runSync);
    };
  }, []);
};
