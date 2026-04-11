/**
 * App.tsx
 */

import { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { AdminRoleSelector } from "./components/auth/AdminRoleSelector";
import { AudioProvider } from "./context/AudioContext";
import { FloatingAudioPlayer } from "./components/features/FloatingAudioPlayer";
import { ChatProvider } from "./context/ChatContext";
import { KnowledgeProvider } from "./context/KnowledgeContext";
import { CallProvider } from "./context/CallContext"; // ✨ أضفنا مزود المكالمات
import { Capacitor } from '@capacitor/core';

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
  <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-300">
    <div className="text-center">
      <Loader2 className="w-12 h-12 animate-spin text-brand-green mx-auto mb-4" />
      <p className="text-muted-foreground text-sm font-tajawal">جاري التحميل...</p>
    </div>
  </div>
);

const AppContent = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // جسر التنقل: يسمح لخدمة OneSignal بالتنقل داخل التطبيق
  useEffect(() => {
    (window as any).navigateApp = (path: string) => {
      if (path) navigate(path);
    };
  }, [navigate]);

  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'user' | null>(() => {
    const stateMode = (location.state as any)?.adminViewMode;
    if (stateMode) return stateMode;
    return localStorage.getItem('adminViewMode') as 'admin' | 'user' | null;
  });

  // ── فحص استحقاق "قسم السعات" ──────────────────────────────────────
  // المعرف الثابت لقسم "تجهيز خدمات المعلوماتية" من seed_departments.sql
  const CAPACITIES_DEPT_ID = '33333333-2222-2222-2222-222222222222';

  const [hasCapacities, setHasCapacities] = useState(false);
  const [capacitiesChecked, setCapacitiesChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasCapacities(false);
      setCapacitiesChecked(true);
      return;
    }

    // 1. فحص صريح: إذا كان admin_role = 'capacities'
    if (user.admin_role === 'capacities') {
      setHasCapacities(true);
      setCapacitiesChecked(true);
      return;
    }

    // 2. فحص تلقائي: هل ينتمي لقسم تجهيز خدمات المعلوماتية أو أقسامه الفرعية؟
    if (!user.department_id) {
      setHasCapacities(false);
      setCapacitiesChecked(true);
      return;
    }

    const checkDepartment = async () => {
      try {
        const { supabase } = await import('./lib/supabase');
        // جلب القسم الحالي للموظف
        const { data: dept } = await supabase
          .from('departments')
          .select('id, parent_id')
          .eq('id', user.department_id)
          .single();

        if (dept) {
          // القسم نفسه أو القسم الأب هو "تجهيز خدمات المعلوماتية"
          const isEligible =
            dept.id === CAPACITIES_DEPT_ID ||
            dept.parent_id === CAPACITIES_DEPT_ID;
          setHasCapacities(isEligible);
        }
      } catch (err) {
        console.error('فشل فحص استحقاق السعات:', err);
      } finally {
        setCapacitiesChecked(true);
      }
    };

    checkDepartment();
  }, [user]);

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

  // التحقق مما إذا كان التطبيق يعمل كـ PWA مثبت أو تطبيق أصلي (APK) عن طريق المكتبة الرسمية أو الـ Hostname
  const isCapacitor = Capacitor.isNativePlatform() || (window.location.hostname === 'localhost' && /Android|iPhone|iPad/i.test(navigator.userAgent));
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone ||
    isCapacitor;

  // إظهار شاشة التحميل أثناء التحقق من الجلسة أو فحص السعات
  if (loading || !capacitiesChecked) return <LoadingScreen />;

  // إذا لم يكن هناك مستخدم، نعرض LauncherPage ونحدد هل تظهر صفحة الاختيار أم صفحة الدخول فوراً
  if (!user) {
    return (
      <LauncherPage 
        onProceed={() => {
          setHasProceeded(true);
          sessionStorage.setItem('hasChosenWeb', 'true');
        }}
        initialShowLogin={isStandalone || hasProceeded}
      />
    );
  }

  // ── توجيه المستخدم حسب الصلاحيات (للمستخدمين المسجلين فقط) ──
  const isAdmin = user.role === 'admin';
  const needsRoleSelection = isAdmin || hasCapacities;

  if (needsRoleSelection) {
    // إذا لم يختر المستخدم وضع الدخول بعد
    if (!adminViewMode) {
      return <AdminRoleSelector onSelect={setAdminViewMode} hasCapacities={hasCapacities} />;
    }
    // عرض الواجهة المختارة
    if (adminViewMode === 'user') return <Dashboard />;
    if (adminViewMode === 'admin' && isAdmin) return <AdminDashboard />;
    // fallback
    return <Dashboard />;
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
