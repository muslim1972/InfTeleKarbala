'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { AttendanceRecord } from '../types';
import { Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface AttendanceHistoryProps {
  attendanceHistory: AttendanceRecord[];
  loading: boolean;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  present: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'حاضر' },
  absent: { bg: 'bg-red-100', text: 'text-red-700', label: 'غائب' },
  late: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'متأخر' },
  early_leave: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'انصراف مبكر' }
};

export default function AttendanceHistory({
  attendanceHistory,
  loading
}: AttendanceHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '--:--';
    return new Date(timeString).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const isUnverified = (notes?: string) => {
    if (!notes) return false;
    return notes.includes('الكاميرا') || 
           notes.includes('وجه') || 
           notes.includes('خلل') || 
           notes.includes('فشل') ||
           notes.includes('بدون');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          سجل الحضور
        </h2>

        {attendanceHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>لا توجد سجلات حضور</p>
          </div>
        ) : (
          <div className="space-y-3">
            {attendanceHistory.map((record, index) => {
              const statusStyle = statusColors[record.status] || statusColors.present;
              const isExpanded = expandedId === record.id;
              const unverified = isUnverified(record.notes);

              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => toggleExpand(record.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-gray-800">
                          {formatDate(record.created_at)}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span className={unverified ? 'text-rose-600 font-extrabold' : ''}>
                            {formatTime(record.check_in)}
                          </span>
                          <span> - </span>
                          <span className={unverified ? 'text-rose-600 font-extrabold' : ''}>
                            {formatTime(record.check_out)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="border-t border-gray-200 p-4 bg-gray-50"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">موقع الحضور: </span>
                          <span className="text-gray-800">{record.check_in_location || 'غير محدد'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">موقع الانصراف: </span>
                          <span className="text-gray-800">{record.check_out_location || 'غير محدد'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">تحقق بصمة الحضور: </span>
                          <span className={record.check_in_verified_by_biometric ? 'text-emerald-600' : 'text-gray-500'}>
                            {record.check_in_verified_by_biometric ? 'نعم' : 'لا'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">تحقق بصمة الانصراف: </span>
                          <span className={record.check_out_verified_by_biometric ? 'text-emerald-600' : 'text-gray-500'}>
                            {record.check_out_verified_by_biometric ? 'نعم' : 'لا'}
                          </span>
                        </div>
                        {record.notes && (
                          <div className="md:col-span-2">
                            <span className="text-gray-500">ملاحظات: </span>
                            <span className="text-gray-800">{record.notes}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
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
