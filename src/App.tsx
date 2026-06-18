/**
 * App.tsx
 */

import { Suspense, lazy, useState, useEffect, useCallback } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { AdminRoleSelector } from "./components/auth/AdminRoleSelector";
import { IncentivesTabContent } from "./components/features/IncentivesTabContent";
import { AudioProvider } from "./context/AudioContext";
import { FloatingAudioPlayer } from "./components/features/FloatingAudioPlayer";
import { ChatProvider } from "./context/ChatContext";
import { KnowledgeProvider } from "./context/KnowledgeContext";
import { CallProvider } from "./context/CallContext"; // ✨ أضفنا مزود المكالمات
import { Capacitor } from '@capacitor/core';
import { geolocationManager } from "./utils/GeolocationManager";
import { supabase } from "./lib/supabase";

// Lazy Loading
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const VisitorDashboard = lazy(() => import("./pages/VisitorDashboard").then(m => ({ default: m.VisitorDashboard })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const LauncherPage = lazy(() => import("./pages/LauncherPage").then(m => ({ default: m.LauncherPage })));
const SplashScreen = lazy(() => import("./pages/SplashScreen").then(m => ({ default: m.SplashScreen })));
const RequestsPage = lazy(() => import("./features/requests/RequestsPage"));
const LeaveRequestPage = lazy(() => import("./features/requests/pages/LeaveRequestPage"));
const PromotionCoursesPage = lazy(() => import("./features/promotion/PromotionCoursesPage").then(m => ({ default: m.PromotionCoursesPage })));
const SummerTrainingPage = lazy(() => import("./features/training/components/SummerTrainingPage").then(m => ({ default: m.SummerTrainingPage })));
import { CapacitiesIframe } from "./components/admin/dashboard/CapacitiesIframe";
import { NotFound } from "./pages/NotFound";

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
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // جسر التنقل: يسمح لخدمة OneSignal بالتنقل داخل التطبيق
  useEffect(() => {
    (window as any).navigateApp = (path: string) => {
      if (path) navigate(path);
    };
  }, [navigate]);

  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'user' | 'capacities' | 'promotion' | 'training' | 'user_incentives' | null>(() => {
    const stateMode = (location.state as any)?.adminViewMode;
    if (stateMode) return stateMode;
    return localStorage.getItem('adminViewMode') as 'admin' | 'user' | null;
  });

  // ── فحص استحقاق "قسم تجهيز خدمات المعلوماتية" ───────────────────────
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

    // 1. فحص صريح: إذا كان لديه صلاحية السعات مباشرة أو مشرف عام/مطور
    if (
      user.admin_role === 'capacities' || // للاحتياط في حال وجود بيانات قديمة
      user.has_capacities_access || 
      user.admin_role === 'developer' || 
      user.admin_role === 'general'
    ) {
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
      if (!user.department_id) {
          setHasCapacities(false);
          return;
      }
      try {
        // جلب القسم الحالي للموظف
        const { data: dept } = await supabase
          .rpc('get_departments_bypass_rls')
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

  // الاستماع لرسالة تسجيل الخروج من iframe السعات — خروج كامل من التطبيق
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'capacities-logout') {
        logout();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [logout]);

  // إدارة Geolocation: إيقاف التتبع عند تبديل التبويبة لضمان الخصوصية وتوفير الموارد
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("🌓 Tab hidden: Stopping geolocation watches...");
        geolocationManager.clearAllWatches();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Persist view mode choice (لا نحفظ capacities/promotion/training/user_incentives لأنهما وضع مؤقت)
  useEffect(() => {
    if (adminViewMode && adminViewMode !== 'capacities' && adminViewMode !== 'promotion' && adminViewMode !== 'training' && adminViewMode !== 'user_incentives') {
      localStorage.setItem('adminViewMode', adminViewMode);
    }
  }, [adminViewMode]);

  const [hasProceeded, setHasProceeded] = useState(() => {
    return sessionStorage.getItem('hasChosenWeb') === 'true';
  });

  // ── حالة الشاشة الافتتاحية (Splash Screen) ──────────
  const [showSplash, setShowSplash] = useState(() => {
    return sessionStorage.getItem('splashShown') !== 'true';
  });

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem('splashShown', 'true');
    setShowSplash(false);
  }, []);

  // التحقق مما إذا كان التطبيق يعمل كـ PWA مثبت أو تطبيق أصلي (APK) عن طريق المكتبة الرسمية أو الـ Hostname
  const isCapacitor = Capacitor.isNativePlatform() || (window.location.hostname === 'localhost' && /Android|iPhone|iPad/i.test(navigator.userAgent));
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone ||
    isCapacitor;

  // إظهار شاشة التحميل أثناء التحقق من الجلسة أو فحص السعات
  if (loading || !capacitiesChecked) return <LoadingScreen />;

  // ── عرض الشاشة الافتتاحية (مرة واحدة لكل جلسة — لجميع الحالات) ──
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

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
  const hasPromotion = user.can_access_promotion === true;
  const hasTraining = user.is_training_supervisor === true || isAdmin || user.admin_role === 'developer' || user.admin_role === 'general';
  const needsRoleSelection = true; // All users now see the Welcome Dashboard

  if (user.role === 'visitor') {
    return <VisitorDashboard />;
  }

  if (needsRoleSelection) {
    // إذا لم يختر المستخدم وضع الدخول بعد
    if (!adminViewMode) {
      return <AdminRoleSelector onSelect={setAdminViewMode as any} hasCapacities={hasCapacities} hasPromotion={hasPromotion} hasTraining={hasTraining} />;
    }
    // عرض واجهة السعات كـ iframe داخلي
    if (adminViewMode === 'capacities') {
      return <CapacitiesIframe onBack={() => setAdminViewMode(null)} />;
    }
    // عرض واجهة دورات الترفيع
    if (adminViewMode === 'promotion') {
      return <PromotionCoursesPage onBack={() => setAdminViewMode(null)} />;
    }
    // عرض واجهة التدريب الصيفي
    if (adminViewMode === 'training') {
       return <SummerTrainingPage onBack={() => setAdminViewMode(null)} />;
    }
    // عرض الحوافز المستقلة لجميع المستخدمين
    if (adminViewMode === 'user_incentives') {
       return (
         <div className="pt-8 px-4 relative max-w-5xl mx-auto pb-20">
             <button onClick={() => setAdminViewMode(null)} className="mb-4 text-sm bg-secondary px-4 py-2 rounded-xl border border-border shadow-sm flex items-center gap-2 hover:bg-secondary/80">
                 العودة للصفحة الرئيسية
             </button>
             <IncentivesTabContent isAdminView={false} />
         </div>
       );
    }
    // عرض الواجهة المختارة
    if (adminViewMode === 'user') return <Dashboard onBack={() => setAdminViewMode(null)} />;
    if (adminViewMode === 'admin' && isAdmin) return <AdminDashboard onBack={() => setAdminViewMode(null)} />;
    // fallback
    return <Dashboard />;
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
                    <Route path="/" element={<AppContent />} />
                    <Route path="/login" element={<AppContent />} />
                    <Route path="/*" element={<NotFound />} />
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
