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
    // ===== تصعيد مستوى التشفير وإزالة أي خيوط تدل على المطور =====
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // إزالة جميع console.log
        drop_debugger: true,     // إزالة debugger
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'],
        passes: 3,               // إجراء 3 تمريرات ضغط لتعقيد الكود الناتج وللتأمين الأقصى
        global_defs: {
          'process.env.NODE_ENV': JSON.stringify('production')
        }
      },
      mangle: {
        toplevel: true,          // تشفير أسماء المتغيرات والوظائف في المستوى الأعلى
        properties: false,        // لا نشفر الخصائص لتجنب كسر واجهات API (إلا إذا حددنا مستثنيات)
      },
      format: {
        comments: false,         // حذف التعليقات نهائياً
        ascii_only: true,        // تحويل الأحرف غير اللاتينية إلى رموز لمنع قراءتها وللتحصين الأمني
        beautify: false,
      },
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
