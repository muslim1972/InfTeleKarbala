import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { geolocationManager } from './utils/GeolocationManager';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { ChatSettingsProvider } from './context/ChatSettingsContext';

// 🛡️ تنظيف الكونسول: إخفاء رسائل الديباغ وإبقاء رسائل الخطأ فقط
if (typeof window !== 'undefined') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  // سنبقي على console.error و console.warn للضرورة
}

// 🛡️ معالجة مشكلة التخزين المؤقت (Cache) عند رفع تحديث جديد
// عندما يحتفظ المتصفح بنسخة قديمة ويحاول جلب ملفات JS لم تعد موجودة في السيرفر الجديد
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    // تحديث الصفحة تلقائياً مرة واحدة لتفريغ الكاش القديم وجلب الملفات الجديدة
    if (!sessionStorage.getItem('vite-reloaded')) {
      sessionStorage.setItem('vite-reloaded', 'true');
      window.location.reload();
    }
  });

  // معالجة أخطاء فشل تحميل الـ Chunks عند التنقل في التطبيق (خصوصاً في PWA)
  window.addEventListener('error', (e) => {
    if (
      e.message &&
      (e.message.includes('Failed to fetch dynamically imported module') ||
       e.message.includes('Importing a module script failed'))
    ) {
      console.warn('Chunk load error detected, forcing reload...');
      if (!sessionStorage.getItem('chunk-error-reloaded')) {
        sessionStorage.setItem('chunk-error-reloaded', 'true');
        // استخدام true لفرض جلب النسخة الجديدة من السيرفر متجاوزاً الكاش
        window.location.reload();
      }
    }
  });

  // معالجة نفس الخطأ إذا ظهر كـ Promise Rejection غير معالج
  window.addEventListener('unhandledrejection', (e) => {
    if (
      e.reason && 
      e.reason.message &&
      (e.reason.message.includes('Failed to fetch dynamically imported module') ||
       e.reason.message.includes('Importing a module script failed'))
    ) {
      console.warn('Chunk load error detected in promise, forcing reload...');
      if (!sessionStorage.getItem('chunk-error-reloaded')) {
        sessionStorage.setItem('chunk-error-reloaded', 'true');
        window.location.reload();
      }
    }
  });
}

// إنشاء عميل react-query مع إعدادات محسنة
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 ثانية قبل اعتبار البيانات قديمة
      gcTime: 5 * 60 * 1000, // 5 دقائق في الذاكرة
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AccessibilityProvider>
          <ChatSettingsProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ChatSettingsProvider>
        </AccessibilityProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
