/**
 * App.tsx - محسّن باستخدام lazy loading
 * يقلل حجم التحميل الأولي بشكل كبير
 */

import { Suspense, lazy, useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { AdminRoleSelector } from "./components/auth/AdminRoleSelector";

// Lazy loading للصفحات الثقيلة
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const VisitorDashboard = lazy(() => import("./pages/VisitorDashboard").then(m => ({ default: m.VisitorDashboard })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));

// مكون التحميل
const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
      <p className="text-white/60 text-sm">جاري التحميل...</p>
    </div>
  </div>
);

const AppContent = () => {
  const { user, loading } = useAuth();
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'user' | null>(null);

  // Reset view mode when user logs out
  useEffect(() => {
    if (!user) {
      setAdminViewMode(null);
    }
  }, [user]);

  // إظهار شاشة التحميل أثناء التحقق من الجلسة
  if (loading) return <LoadingScreen />;

  if (!user) return <Login />;

  // توجيه المستخدم حسب الصلاحية
  if (user.role === 'admin') {
    // If choice not made, show selector
    if (!adminViewMode) {
      return <AdminRoleSelector onSelect={setAdminViewMode} />;
    }
    // Render selected view
    if (adminViewMode === 'user') return <Dashboard />;
    return <AdminDashboard />;
  }

  if (user.role === 'visitor') {
    return <VisitorDashboard />;
  }

  return <Dashboard />;
};

function App() {
  return (
    <div dir="rtl">
      <AuthProvider>
        <Toaster position="top-center" reverseOrder={false} />
        <Suspense fallback={<LoadingScreen />}>
          <AppContent />
        </Suspense>
      </AuthProvider>
    </div>
  );
}

export default App;
