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
    // ===== تسريع زمن البناء وتفادي Transpilation الزائد =====
    target: 'esnext',
    reportCompressedSize: false, // يوفر 10-20 ثانية من حساب الـ gzip لكل ملف وأصل
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: true,
    // إزالة console.log و debugger من الإنتاج مع إبقاء console.error و console.warn
    esbuild: {
      pure: ['console.log', 'console.info', 'console.debug'],
      drop: ['debugger'],
      legalComments: 'none',
      treeShaking: true,
    },
    rollupOptions: {
      output: {
        sourcemap: false,
        manualChunks: {
          // فصل المكتبات الأساسية
          'vendor-react': ['react', 'react-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['localforage', 'react-hot-toast', 'date-fns'],
          'vendor-pdf': ['pdf-lib', '@pdf-lib/fontkit'],
          'vendor-html2pdf': ['html2pdf.js', 'html2canvas', 'jspdf'],
          'vendor-excel': ['exceljs'],
          'vendor-katex': ['katex', 'react-katex'],
          'vendor-face-api': ['@vladmandic/face-api'],
          'vendor-livekit': ['livekit-client', '@livekit/components-react'],
        }
      }
    },
    chunkSizeWarningLimit: 2500,
  }
})
