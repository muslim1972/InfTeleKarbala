'use client';

import { motion } from 'framer-motion';
import type { AttendanceStats } from '../types';
import { BarChart3, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

interface AttendanceStatisticsProps {
  stats: AttendanceStats | null;
  loading: boolean;
}

export default function AttendanceStatistics({
  stats,
  loading
}: AttendanceStatisticsProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">لا توجد إحصائيات متاحة</p>
      </div>
    );
  }

  const statsCards = [
    {
      icon: CheckCircle2,
      label: 'أيام الحضور',
      value: stats.total_present,
      color: 'emerald',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      borderColor: 'border-emerald-200'
    },
    {
      icon: XCircle,
      label: 'أيام الغياب',
      value: stats.total_absent,
      color: 'red',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      borderColor: 'border-red-200'
    },
    {
      icon: Clock,
      label: 'مرات التأخير',
      value: stats.total_late,
      color: 'amber',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      borderColor: 'border-amber-200'
    },
    {
      icon: Zap,
      label: 'انصراف مبكر',
      value: stats.total_early_leave,
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-200'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Attendance Rate Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-8 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">نسبة الحضور</h2>
            <p className="text-emerald-100">للشهر الحالي</p>
          </div>
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-3xl font-bold">{stats.attendance_rate.toFixed(0)}%</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-2xl shadow-lg p-6 border-2 ${stat.borderColor}`}
            >
              <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
              <div className="text-3xl font-bold text-gray-800 mb-1">
                {stat.value}
              </div>
              <div className="text-gray-600 font-medium">
                {stat.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Progress Bar for Attendance Rate */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl shadow-lg p-8"
      >
        <h3 className="text-lg font-bold text-gray-800 mb-4">تقدم الحضور</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">نسبة الحضور</span>
            <span className="font-semibold text-emerald-600">{stats.attendance_rate.toFixed(1)}%</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.attendance_rate}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
