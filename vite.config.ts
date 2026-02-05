import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageJson from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // تعريف رقم النسخة ليكون متاحاً في التطبيق
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // فصل المكتبات الثقيلة
          'vendor-react': ['react', 'react-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['localforage', 'react-hot-toast'],
        }
      }
    },
    // تقليل تحذيرات الحجم
    chunkSizeWarningLimit: 600,
  }
})
