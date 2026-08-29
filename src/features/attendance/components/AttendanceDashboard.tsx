'use client';

import { useState, useEffect, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { useAttendance } from '../hooks/useAttendance';
import { getLocalDateStr } from '../services/attendanceService';
import { Fingerprint, Calendar, BarChart3, ShieldCheck } from 'lucide-react';

const AttendanceCheckInOut = lazy(() => import('./AttendanceCheckInOut'));
const AttendanceHistory = lazy(() => import('./AttendanceHistory'));
const AttendanceStatistics = lazy(() => import('./AttendanceStatistics'));
const BiometricEnrollment = lazy(() => import('./BiometricEnrollment').then(m => ({ default: m.BiometricEnrollment })));

interface AttendanceDashboardProps {
  employeeId: string;
}

type ActiveTab = 'check' | 'history' | 'stats' | 'settings';

export default function AttendanceDashboard({ employeeId }: AttendanceDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('check');
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
  // عند تحوّل التاريخ المحلي (منتصف الليل) تُعاد بيانات اليوم فتُعرض بطاقة يوم
  // جديد فارغة فوراً بدلاً من بقائها على بصمات الأمس. الفحص كل 30 ثانية +
  // عند عودة التبويب للواجهة (المتصفح يخنق المؤقتات في الخلفية).
  useEffect(() => {
    const checkDateChange = () => {
      const now = getLocalDateStr();
      if (now !== viewedDate) {
        setViewedDate(now);
        loadTodayAttendance(); // بطاقة يوم جديد فارغة دون تحديث يدوي للصفحة
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
      const today = new Date();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-2">نظام الحضور والانصراف</h1>
          <p className="text-gray-600">تسجيل الحضور باستخدام البصمة الإلكترونية</p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-2 mb-6">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-h-[400px]">
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
