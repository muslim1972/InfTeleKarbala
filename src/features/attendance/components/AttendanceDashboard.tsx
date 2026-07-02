'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAttendance } from '../hooks/useAttendance';
import AttendanceCheckInOut from './AttendanceCheckInOut';
import AttendanceHistory from './AttendanceHistory';
import AttendanceStatistics from './AttendanceStatistics';
import AttendanceExceptionRequest from './AttendanceExceptionRequest';
import { BiometricEnrollment } from './BiometricEnrollment';
import { Fingerprint, Calendar, BarChart3, FileText, ShieldCheck } from 'lucide-react';

interface AttendanceDashboardProps {
  employeeId: string;
}

type ActiveTab = 'check' | 'history' | 'stats' | 'exceptions' | 'settings';

export default function AttendanceDashboard({ employeeId }: AttendanceDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('check');
  const {
    todayAttendance,
    attendanceHistory,
    exceptions,
    stats,
    loading,
    error,
    loadTodayAttendance,
    loadAttendanceHistory,
    loadExceptions,
    loadStats
  } = useAttendance(employeeId);

  useEffect(() => {
    loadTodayAttendance();
  }, [loadTodayAttendance]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadAttendanceHistory();
    } else if (activeTab === 'stats') {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      loadStats(firstDay, lastDay);
    } else if (activeTab === 'exceptions') {
      loadExceptions();
    }
  }, [activeTab, loadAttendanceHistory, loadExceptions, loadStats]);

  const tabs = [
    { id: 'check' as ActiveTab, label: 'الحضور والانصراف', icon: Fingerprint },
    { id: 'history' as ActiveTab, label: 'سجل الحضور', icon: Calendar },
    { id: 'stats' as ActiveTab, label: 'الإحصائيات', icon: BarChart3 },
    { id: 'exceptions' as ActiveTab, label: 'الإجازات', icon: FileText },
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
          {activeTab === 'check' && (
            <AttendanceCheckInOut
              employeeId={employeeId}
              todayAttendance={todayAttendance}
              loading={loading}
            />
          )}
          {activeTab === 'history' && (
            <AttendanceHistory
              attendanceHistory={attendanceHistory}
              loading={loading}
            />
          )}
          {activeTab === 'stats' && (
            <AttendanceStatistics
              stats={stats}
              loading={loading}
            />
          )}
          {activeTab === 'exceptions' && (
            <AttendanceExceptionRequest
              employeeId={employeeId}
              exceptions={exceptions}
              loading={loading}
            />
          )}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto">
              <BiometricEnrollment />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
