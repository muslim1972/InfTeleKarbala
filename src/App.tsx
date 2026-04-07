/**
 * App.tsx
 */

import { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { AdminRoleSelector } from "./components/auth/AdminRoleSelector";
import { AudioProvider } from "./context/AudioContext";
import { FloatingAudioPlayer } from "./components/features/FloatingAudioPlayer";
import { ChatProvider } from "./context/ChatContext";
import { KnowledgeProvider } from "./context/KnowledgeContext";
import { CallProvider } from "./context/CallContext"; // ✨ أضفنا مزود المكالمات

// Lazy Loading
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const VisitorDashboard = lazy(() => import("./pages/VisitorDashboard").then(m => ({ default: m.VisitorDashboard })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const LauncherPage = lazy(() => import("./pages/LauncherPage").then(m => ({ default: m.LauncherPage })));
const RequestsPage = lazy(() => import("./features/requests/RequestsPage"));
const LeaveRequestPage = lazy(() => import("./features/requests/pages/LeaveRequestPage"));

// Loading Component
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
  const location = useLocation();
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'user' | null>(() => {
    const stateMode = (location.state as any)?.adminViewMode;
    if (stateMode) return stateMode;
    return localStorage.getItem('adminViewMode') as 'admin' | 'user' | null;
  });

  // Reset view mode when user logs out
  useEffect(() => {
    if (!user) {
      setAdminViewMode(null);
      localStorage.removeItem('adminViewMode');
    }
  }, [user]);

  // Persist view mode choice
  useEffect(() => {
    if (adminViewMode) {
      localStorage.setItem('adminViewMode', adminViewMode);
    }
  }, [adminViewMode]);

  const [hasProceeded, setHasProceeded] = useState(() => {
    return sessionStorage.getItem('hasChosenWeb') === 'true';
  });

  // التحقق مما إذا كان التطبيق يعمل كـ PWA مثبت أو تطبيق أصلي (APK)
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone ||
    (window as any).Capacitor?.isNativePlatform();

  // إظهار شاشة التحميل أثناء التحقق من الجلسة
  if (loading) return <LoadingScreen />;

  // إذا لم يكن في وضع التثبيت (الـ PWA أو APK) ولم يقم بالاختيار بعد، نظهر صفحة الهبوط
  if (!isStandalone && !hasProceeded) {
    return <LauncherPage onProceed={() => {
      setHasProceeded(true);
      sessionStorage.setItem('hasChosenWeb', 'true');
    }} />;
  }

  if (!user) return <LauncherPage />;

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

const ChatLayout = lazy(() => import("./components/chat/ChatLayout").then(m => ({ default: m.ChatLayout })));

// Protected Routes logic
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;
  return <>{children}</>;
};

function App() {
  return (
    <div dir="rtl">
      <AuthProvider>
        <AudioProvider>
          <ChatProvider>
            <CallProvider> {/* ✨ نظام المكالمات أصبح نشطاً الآن */}
              <KnowledgeProvider>
                <Toaster position="top-center" reverseOrder={false} />
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    <Route path="/chat" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>}>
                      <Route path=":conversationId" element={null} />
                    </Route>
                    <Route path="/requests/leave" element={<ProtectedRoute><LeaveRequestPage /></ProtectedRoute>} />
                    <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
                    <Route path="/*" element={<AppContent />} />
                  </Routes>
                </Suspense>
                <FloatingAudioPlayer />
              </KnowledgeProvider>
            </CallProvider>
          </ChatProvider>
        </AudioProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
