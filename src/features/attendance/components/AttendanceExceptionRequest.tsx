'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAttendance } from '../hooks/useAttendance';
import type { AttendanceException } from '../types';
import { FileText, Plus, Calendar, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { sendPushNotification } from '../../../services/notifications';

interface AttendanceExceptionRequestProps {
  employeeId: string;
  exceptions: AttendanceException[];
  loading: boolean;
}

const exceptionTypes = [
  { value: 'time_leave', label: 'إجازة زمنية' }
];

const statusConfig: Record<string, { icon: any; color: string; label: string; bg: string }> = {
    pending: { icon: AlertCircle, color: 'text-amber-600', label: 'قيد المراجعة', bg: 'bg-amber-100' },
    approved: { icon: CheckCircle2, color: 'text-emerald-600', label: 'مقبول', bg: 'bg-emerald-100' },
    rejected: { icon: XCircle, color: 'text-red-600', label: 'مرفوض', bg: 'bg-red-100' }
  };

export default function AttendanceExceptionRequest({
  employeeId,
  exceptions,
  loading
}: AttendanceExceptionRequestProps) {
  const { requestException } = useAttendance(employeeId);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    exception_date: new Date().toISOString().split('T')[0],
    exception_type: 'time_leave' as const,
    start_time: '',
    end_time: '',
    reason: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Convert time strings (HH:mm) to valid ISO timestamps using the selected date
      const formattedStartTime = formData.start_time ? new Date(`${formData.exception_date}T${formData.start_time}:00`).toISOString() : undefined;
      const formattedEndTime = formData.end_time ? new Date(`${formData.exception_date}T${formData.end_time}:00`).toISOString() : undefined;

      await requestException({
        ...formData,
        start_time: formattedStartTime,
        end_time: formattedEndTime,
        employee_id: employeeId
      });

      // Find direct supervisor to notify
      try {
        const { data: profile } = await supabase.from('profiles').select('department_id, full_name').eq('id', employeeId).single();
        if (profile?.department_id) {
          let currentDeptId = profile.department_id;
          let supervisorId = null;
          let visitedDepts = new Set<string>();
          
          while (currentDeptId && !visitedDepts.has(currentDeptId)) {
            visitedDepts.add(currentDeptId);
            const { data: dept } = await supabase.rpc('get_departments_bypass_rls')
              .select('id, manager_id, parent_id')
              .eq('id', currentDeptId).single();
              
            if (!dept) break;
            
            if (dept.manager_id && dept.manager_id !== employeeId) {
              supervisorId = dept.manager_id;
              break;
            }
            currentDeptId = dept.parent_id;
          }
          
          if (supervisorId) {
            sendPushNotification(
              supervisorId,
              `قام الموظف ${profile.full_name || 'موظف'} بتقديم طلب إجازة زمنية جديد (${formData.exception_date})`,
              { title: "طلب إجازة زمنية", url: `${window.location.origin}/attendance` }
            );
          }
        }
      } catch (notifyErr) {
        console.error("Failed to notify supervisor:", notifyErr);
      }

      toast.success('تم إرسال الطلب بنجاح إلى الإدارة');
      setShowForm(false);
      setFormData({
        exception_date: new Date().toISOString().split('T')[0],
        exception_type: 'time_leave',
        start_time: '',
        end_time: '',
        reason: ''
      });
    } catch (err: any) {
      console.error('Failed to request exception:', err);
      toast.error(err.message || 'فشل إرسال الطلب، الرجاء المحاولة مرة أخرى');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Request Button */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>طلب إجازة</span>
        </button>
      </motion.div>

      {/* Request Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-2xl shadow-lg p-8"
        >
          <h3 className="text-xl font-bold text-gray-800 mb-6">تقديم طلب إجازة</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                نوع الإجازة
              </label>
              <select
                value={formData.exception_type}
                onChange={(e) => setFormData({ ...formData, exception_type: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              >
                {exceptionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                التاريخ
              </label>
              <input
                type="date"
                value={formData.exception_date}
                onChange={(e) => setFormData({ ...formData, exception_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  من الساعة
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  إلى الساعة
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                السبب
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="أدخل سبب الإجازة..."
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? 'جارٍ الإرسال...' : 'إرسال الطلب'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Exceptions List */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <FileText className="w-6 h-6" />
          طلبات الإجازات
        </h2>

        {exceptions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>لا توجد طلبات إجازة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {exceptions.map((exception, index) => {
              const config = statusConfig[exception.status];
              const Icon = config.icon;

              return (
                <motion.div
                  key={exception.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-lg text-gray-800">
                          {exception.exception_type === 'time_leave' ? 'إجازة زمنية' : exception.exception_type === 'vacation' ? 'إجازة سنوية' : exception.exception_type === 'sick_leave' ? 'إجازة مرضية' : exception.exception_type === 'personal_leave' ? 'إجازة شخصية' : exception.exception_type === 'business_trip' ? 'رحلة عمل' : exception.exception_type}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${config.bg} ${config.color}`}>
                          <Icon className="w-4 h-4" />
                          {config.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(exception.exception_date)}
                        </span>
                        {exception.start_time && exception.end_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {exception.start_time} - {exception.end_time}
                          </span>
                        )}
                      </div>

                      {exception.reason && (
                        <p className="text-gray-600 text-sm mt-2">{exception.reason}</p>
                      )}
                    </div>
                  </div>

                  {exception.approved_at && (
                    <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                      تمت المراجعة في {formatDate(exception.approved_at)}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
