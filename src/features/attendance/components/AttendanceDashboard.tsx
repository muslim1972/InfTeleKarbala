'use client';

import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { useAttendance } from '../hooks/useAttendance';
import { getLocalDateStr } from '../services/attendanceService';
import { getServerNow } from '../services/serverTimeService';
import { Fingerprint, Calendar, BarChart3, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import CompactLiveClock from './CompactLiveClock';

import { useAuth } from '../../../context/AuthContext';

const AttendanceCheckInOut = lazy(() => import('./AttendanceCheckInOut'));
const AttendanceHistory = lazy(() => import('./AttendanceHistory'));
const AttendanceStatistics = lazy(() => import('./AttendanceStatistics'));
const BiometricEnrollment = lazy(() => import('./BiometricEnrollment').then(m => ({ default: m.BiometricEnrollment })));

interface AttendanceDashboardProps {
  employeeId: string;
  onBack?: () => void;
}

type ActiveTab = 'check' | 'history' | 'stats' | 'settings';

export default function AttendanceDashboard({ employeeId, onBack }: AttendanceDashboardProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('check');
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // تاريخ اليوم لحظة العرض — يُراقَب باستمرار لكشف تحوّل منتصف الليل
  const [viewedDate, setViewedDate] = useState(() => getLocalDateStr());
  const {
    todayAttendance,
    attendanceHistory,
    stats,
    loading,
    error,
    loadTodayAttendance,
    loadAttendanceHistory,
    loadStats
  } = useAttendance(employeeId);

  useEffect(() => {
    loadTodayAttendance();
  }, [loadTodayAttendance]);

  // ─── مراقب تحوّل التاريخ ───
  useEffect(() => {
    const checkDateChange = () => {
      const now = getLocalDateStr();
      if (now !== viewedDate) {
        setViewedDate(now);
        loadTodayAttendance();
      }
    };
    const interval = window.setInterval(checkDateChange, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') checkDateChange(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [viewedDate, loadTodayAttendance]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadAttendanceHistory();
    } else if (activeTab === 'stats') {
      const today = getServerNow();
      const firstDay = getLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
      const lastDay = getLocalDateStr(new Date(today.getFullYear(), today.getMonth() + 1, 0));
      loadStats(firstDay, lastDay);
    }
  }, [activeTab, loadAttendanceHistory, loadStats]);

  const tabs = [
    { id: 'check' as ActiveTab, label: 'الحضور والانصراف', icon: Fingerprint },
    { id: 'history' as ActiveTab, label: 'سجل الحضور', icon: Calendar },
    { id: 'stats' as ActiveTab, label: 'الإحصائيات', icon: BarChart3 },
    { id: 'settings' as ActiveTab, label: 'إعدادات البصمة', icon: ShieldCheck }
  ];

  // دالة التمرير الأفقي للأزرار يمين/يسار
  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = 150;
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/60 to-teal-50/60 dark:from-slate-900 dark:to-slate-950 pb-12">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4">
        {/* Header: السطر الأول (العنوان يأخذ المساحة ديناميكياً + زر العودة) */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-center justify-between gap-2"
        >
          <h1 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white flex-1 min-w-0 truncate">
            نظام الحضور والانصراف
          </h1>

          {onBack && (
            <button
              onClick={onBack}
              className="text-xs sm:text-sm bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200 transition-all shrink-0 active:scale-95"
              title="العودة للصفحة الرئيسية"
            >
              <span>العودة</span>
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </motion.div>

        {/* السطر الثاني: دمج بطاقة حسابك الحالي وبطاقة الوقت والتاريخ في نفس السطر */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 min-[440px]:grid-cols-2 gap-2 mb-4"
        >
          {/* بطاقة حسابك الحالي */}
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl py-2 px-3 shadow-sm border border-emerald-100 dark:border-slate-700 flex items-center gap-2.5 min-w-0">
             <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
               <Fingerprint className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
             </div>
             <div className="min-w-0 flex-1">
               <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-tight">حسابك الحالي</p>
               <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate leading-snug">
                 {user?.full_name || user?.username || 'مستخدم'}
               </p>
             </div>
          </div>

          {/* بطاقة الوقت والتاريخ */}
          <div className="flex items-center min-w-0">
            <CompactLiveClock className="w-full justify-between" />
          </div>
        </motion.div>

        {/* شريط التبويبات المطور: حذف شريط التمرير الأفقي واستبداله بأزرار التمرير يمين/يسار */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-1.5 mb-5 border border-slate-100 dark:border-slate-700/60 flex items-center gap-1">
          {/* زر تمرير يمين */}
          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="p-1 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 active:scale-95"
            title="تمرير لليمين"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* التبويبات بدون Scrollbar الافتراضي */}
          <div
            ref={tabsContainerRef}
            className="flex-1 flex gap-1.5 overflow-x-auto scroll-smooth scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 px-0.5"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all duration-200 whitespace-nowrap text-xs sm:text-sm font-bold shrink-0 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* زر تمرير يسار */}
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="p-1 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 active:scale-95"
            title="تمرير لليسار"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
            {error}
          </div>
        )}

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden min-h-[400px]">
            <Suspense fallback={
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            }>
              {activeTab === 'check' && (
                <AttendanceCheckInOut
                  employeeId={employeeId}
                  todayAttendance={todayAttendance}
                  loading={loading}
                  onAttendanceUpdate={loadTodayAttendance}
                />
              )}

              {activeTab === 'history' && (
                <AttendanceHistory attendanceHistory={attendanceHistory} loading={loading} />
              )}

              {activeTab === 'stats' && stats && (
                <AttendanceStatistics stats={stats} loading={loading} />
              )}

              {activeTab === 'settings' && (
                <BiometricEnrollment />
              )}
            </Suspense>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
