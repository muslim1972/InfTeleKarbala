import { useState, useEffect, useMemo } from 'react';
import { useLiveAttendance } from '../hooks/useLiveAttendance';
import { deriveLiveStatus, computeWorkedMinutes, formatDurationArabic } from '../utils/attendanceCalc';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, LogOut, Coffee, AlertCircle, Search, Filter } from 'lucide-react';

// A simple timer component that ticks every minute to update the "worked duration" visually
const LiveTimer = ({ record }: { record: any }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Only tick if they are currently working or on break
    const status = deriveLiveStatus(record);
    if (status === 'working' || status === 'on_break') {
      const interval = setInterval(() => setNow(new Date()), 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [record]);

  const mins = computeWorkedMinutes(record, now);
  return <span className="font-mono">{formatDurationArabic(mins)}</span>;
};

export default function LiveAttendanceBoard() {
  const { records, loading, error } = useLiveAttendance();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Process records
  const processedRecords = useMemo(() => {
    return records.map(rec => ({
      ...rec,
      liveStatus: deriveLiveStatus(rec)
    }));
  }, [records]);

  // Compute Stats
  const stats = useMemo(() => {
    let working = 0;
    let on_break = 0;
    let late = 0;
    let checked_out = 0;

    processedRecords.forEach(rec => {
      if (rec.liveStatus === 'working') working++;
      if (rec.liveStatus === 'on_break') on_break++;
      if (rec.liveStatus === 'late') late++;
      if (rec.liveStatus === 'checked_out') checked_out++;
    });

    return { total: processedRecords.length, working, on_break, late, checked_out };
  }, [processedRecords]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return processedRecords.filter(rec => {
      const matchesSearch = rec.employee?.full_name?.includes(search) || 
                            rec.employee?.job_number?.includes(search);
      const matchesStatus = statusFilter === 'all' || rec.liveStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [processedRecords, search, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'on_break': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400';
      case 'late': return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400';
      case 'checked_out': return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'working': return 'متواجد بالعمل';
      case 'on_break': return 'في استراحة';
      case 'late': return 'متأخر';
      case 'checked_out': return 'منصرف';
      default: return 'غير معروف';
    }
  };

  if (loading && records.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-200 flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">إجمالي الحاضرين</span>
          </div>
          <span className="text-3xl font-bold text-slate-800 dark:text-white">{stats.total}</span>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">متواجد الآن</span>
          </div>
          <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{stats.working}</span>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/30 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 mb-2">
            <Coffee className="w-4 h-4" />
            <span className="text-sm font-medium">في استراحة</span>
          </div>
          <span className="text-3xl font-bold text-amber-700 dark:text-amber-400">{stats.on_break}</span>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-800/30 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-500 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">متأخر</span>
          </div>
          <span className="text-3xl font-bold text-rose-700 dark:text-rose-400">{stats.late}</span>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">منصرف</span>
          </div>
          <span className="text-3xl font-bold text-slate-700 dark:text-slate-300">{stats.checked_out}</span>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرقم الوظيفي..."
            className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', 'working', 'on_break', 'late', 'checked_out'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === status 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {status === 'all' ? 'الكل' : getStatusText(status)}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence>
          {filteredRecords.map((record) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={record.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
            >
              {/* Top Accent line depending on status */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${getStatusColor(record.liveStatus).split(' ')[0]}`} />
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-500 dark:text-slate-400 shrink-0">
                  {record.employee?.full_name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 dark:text-white truncate">
                    {record.employee?.full_name || 'غير معروف'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {record.employee?.job_number} • {record.department?.name || 'بدون قسم'}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">وقت الدخول:</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {record.check_in ? record.check_in.substring(11, 16) : '--:--'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">مدة العمل:</span>
                  <div className="font-medium text-blue-600 dark:text-blue-400">
                    <LiveTimer record={record} />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700">
                <span className={`px-2.5 py-1 text-xs rounded-lg font-medium border ${getStatusColor(record.liveStatus)}`}>
                  {getStatusText(record.liveStatus)}
                </span>
                
                {record.liveStatus === 'on_break' && record.time_leave_out && (
                  <span className="text-xs text-slate-500">
                    منذ {record.time_leave_out.substring(11, 16)}
                  </span>
                )}
                {record.liveStatus === 'checked_out' && record.check_out && (
                  <span className="text-xs text-slate-500">
                    في {record.check_out.substring(11, 16)}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredRecords.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            <Filter className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>لا يوجد سجلات تطابق عوامل التصفية الحالية</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
