'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  attendanceRecordService,
  attendanceExceptionService,
  attendanceDeviceService
} from '../services/attendanceService';
import type { AttendanceRecord, AttendanceException, AttendanceDevice } from '../types';
import { Users, Calendar, Smartphone, CheckCircle2, XCircle } from 'lucide-react';

export default function AdminAttendanceDashboard() {
  const [activeTab, setActiveTab] = useState<'today' | 'exceptions' | 'devices'>('today');
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [pendingExceptions, setPendingExceptions] = useState<AttendanceException[]>([]);
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTodayAttendance = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const records = await attendanceRecordService.getByDate(today);
      setTodayAttendance(records);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingExceptions = async () => {
    setLoading(true);
    try {
      const exceptions = await attendanceExceptionService.getAllPending();
      setPendingExceptions(exceptions);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    setLoading(true);
    try {
      const allDevices = await attendanceDeviceService.getAll();
      setDevices(allDevices);
    } finally {
      setLoading(false);
    }
  };

  const approveException = async (id: string, approvedBy: string) => {
    try {
      await attendanceExceptionService.updateStatus(id, 'approved', approvedBy);
      await loadPendingExceptions();
    } catch (err) {
      console.error('Failed to approve exception:', err);
    }
  };

  const rejectException = async (id: string, approvedBy: string) => {
    try {
      await attendanceExceptionService.updateStatus(id, 'rejected', approvedBy);
      await loadPendingExceptions();
    } catch (err) {
      console.error('Failed to reject exception:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'today') {
      loadTodayAttendance();
    } else if (activeTab === 'exceptions') {
      loadPendingExceptions();
    } else if (activeTab === 'devices') {
      loadDevices();
    }
  }, [activeTab]);

  const tabs = [
    { id: 'today' as const, label: 'حضور اليوم', icon: Users },
    { id: 'exceptions' as const, label: 'طلبات الإجازة', icon: Calendar },
    { id: 'devices' as const, label: 'الأجهزة', icon: Smartphone }
  ];

  const formatTime = (timeString?: string) => {
    if (!timeString) return '--:--';
    return new Date(timeString).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    present: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'حاضر' },
    absent: { bg: 'bg-red-100', text: 'text-red-700', label: 'غائب' },
    late: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'متأخر' },
    early_leave: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'انصراف مبكر' }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-2">إدارة الحضور والانصراف</h1>
          <p className="text-gray-600">لوحة التحكم لإدارة حضور الموظفين</p>
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
                      ? 'bg-blue-500 text-white shadow-md'
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

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'today' && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">حضور اليوم</h2>
              {loading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-100 rounded-xl" />
                  ))}
                </div>
              ) : todayAttendance.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>لا توجد سجلات حضور لليوم</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">الموظف</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">الحضور</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">الانصراف</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">الحالة</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">تحقق البصمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayAttendance.map((record) => {
                        const statusStyle = statusColors[record.status] || statusColors.present;
                        return (
                          <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-4 px-4 text-gray-800">{record.employee_id}</td>
                            <td className="py-4 px-4 text-gray-600">{formatTime(record.check_in)}</td>
                            <td className="py-4 px-4 text-gray-600">{formatTime(record.check_out)}</td>
                            <td className="py-4 px-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                {statusStyle.label}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                                <div className="flex gap-2">
                                {record.check_in_verified_by_biometric ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-gray-300" />
                                )}
                                {record.check_out_verified_by_biometric ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-gray-300" />
                                )}
                                </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'exceptions' && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">طلبات الإجازة المعلقة</h2>
              {loading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 bg-gray-100 rounded-xl" />
                  ))}
                </div>
              ) : pendingExceptions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>لا توجد طلبات إجازة معلقة</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingExceptions.map((exception) => (
                    <div key={exception.id} className="border border-gray-200 rounded-xl p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-800 mb-2">
                            {exception.employee_id}
                          </h3>
                          <p className="text-gray-600 mb-2">
                            نوع الإجازة: {exception.exception_type === 'time_leave' ? 'إجازة زمنية' : exception.exception_type === 'vacation' ? 'إجازة سنوية' : exception.exception_type === 'sick_leave' ? 'إجازة مرضية' : exception.exception_type === 'personal_leave' ? 'إجازة شخصية' : exception.exception_type === 'business_trip' ? 'رحلة عمل' : exception.exception_type}
                          </p>
                          <p className="text-gray-600 mb-2">
                            التاريخ: {new Date(exception.exception_date).toLocaleDateString('ar-SA')}
                          </p>
                          {exception.reason && (
                            <p className="text-gray-500 text-sm">{exception.reason}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveException(exception.id, 'current-admin-id')}
                            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                          >
                            موافقة
                          </button>
                          <button
                            onClick={() => rejectException(exception.id, 'current-admin-id')}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          >
                            رفض
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'devices' && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">أجهزة تسجيل الحضور</h2>
              {loading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-gray-100 rounded-xl" />
                  ))}
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Smartphone className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>لا توجد أجهزة مسجلة</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {devices.map((device) => (
                    <div key={device.id} className="border border-gray-200 rounded-xl p-6">
                      <h3 className="font-semibold text-lg text-gray-800 mb-2">
                        {device.device_name}
                      </h3>
                      <p className="text-gray-600 mb-2">
                        النوع: {device.device_type}
                      </p>
                      {device.location && (
                        <p className="text-gray-600 mb-2">
                          الموقع: {device.location}
                        </p>
                      )}
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        device.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {device.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
