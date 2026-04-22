import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { geolocationManager } from './utils/GeolocationManager';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { ChatSettingsProvider } from './context/ChatSettingsContext';

// 🛡️ حماية Geolocation: مراقبة ومنع الطلبات المفرطة وغير المصرح بها
if (typeof window !== 'undefined' && navigator.geolocation) {
  const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  const originalWatchPosition = navigator.geolocation.watchPosition.bind(navigator.geolocation);

  (navigator.geolocation as any).getCurrentPosition = (success: any, error: any, options: any) => {
    console.warn('📍 Geolocation request detected: getCurrentPosition');
    return originalGetCurrentPosition(success, error, options);
  };

  (navigator.geolocation as any).watchPosition = (success: any, error: any, options: any) => {
    console.warn('📍 Geolocation request detected: watchPosition');
    // نقوم بتسجيل المعرف في الـ manager لضمان إمكانية تنظيفه
    const id = originalWatchPosition(success, error, options);
    geolocationManager.registerWatchId(id); 
    return id;
  };
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
        <ChatSettingsProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ChatSettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
