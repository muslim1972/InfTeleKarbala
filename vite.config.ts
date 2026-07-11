import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageJson from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // وسيط Deezer API - لتجاوز CORS
      '/deezer-api': {
        target: 'https://api.deezer.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/deezer-api/, ''),
        secure: true,
      },
      // وسيط البحث في يوتيوب - لتسهيل الاكتشاف التلقائي
      '/youtube-search': {
        target: 'https://www.youtube.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/youtube-search/, ''),
        secure: true,
      },
    },
  },
  define: {
    // تعريف رقم النسخة ليكون متاحاً في التطبيق
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    // ===== تحصين أمني: تعطيل Source Maps نهائياً في الإنتاج =====
    sourcemap: false,
    // ===== استخدام esbuild (الافتراضي في Vite) للضغط السريع =====
    // esbuild أسرع 10-20x من Terser مع نفس جودة الإخراج
    minify: 'esbuild',
    // إزالة console و debugger من الإنتاج
    esbuild: {
      drop: ['console', 'debugger'],
      legalComments: 'none',
    },
    rollupOptions: {
      output: {
        // منع توليد ملفات sourcemap حتى في الـ chunks
        sourcemap: false,
        manualChunks: {
          // فصل المكتبات الثقيلة
          'vendor-react': ['react', 'react-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['localforage', 'react-hot-toast'],
          'vendor-pdf': ['pdf-lib', '@pdf-lib/fontkit'], // فصل مكاتب الـ PDF
        }
      }
    },
    // تقليل تحذيرات الحجم لأن مكتبات الـ PDF ثقيلة طبيعياً
    chunkSizeWarningLimit: 2500,
  }
})
