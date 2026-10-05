import { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveAttendance } from '../hooks/useLiveAttendance';
import { useGovernorate } from '../../../context/GovernorateContext';
import { motion } from 'framer-motion';
import { 
  Users, 
  Clock, 
  LogOut, 
  AlertCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  Calendar, 
  LayoutGrid, 
  Table as TableIcon, 
  Printer, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert, 
  Building2,
  ChevronRight,
  ChevronLeft,
  X,
  FileCheck
} from 'lucide-react';
import type { ScheduledEmployeeLiveInfo, LiveEmployeeStatus } from '../../../lib/attendanceHelpers';

// A simple timer component that ticks every minute to update the "worked duration" visually
const LiveDurationBadge = ({ employee }: { employee: ScheduledEmployeeLiveInfo }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (employee.liveStatus === 'working' || employee.liveStatus === 'on_break' || employee.liveStatus === 'late') {
      const interval = setInterval(() => setNow(new Date()), 60000);
      return () => clearInterval(interval);
    }
  }, [employee.liveStatus]);

  if (!employee.checkIn) {
    return <span className="text-slate-400 font-mono text-xs">--</span>;
  }

  // Calculate duration
  const inDate = new Date(employee.checkIn);
  const outDate = employee.checkOut ? new Date(employee.checkOut) : now;
  let mins = Math.max(0, Math.floor((outDate.getTime() - inDate.getTime()) / 60000));
  
  if (employee.timeLeaveOut && employee.timeLeaveReturn) {
    const lOut = new Date(employee.timeLeaveOut);
    const lRet = new Date(employee.timeLeaveReturn);
    mins = Math.max(0, mins - Math.floor((lRet.getTime() - lOut.getTime()) / 60000));
  } else if (employee.timeLeaveOut && !employee.timeLeaveReturn && !employee.checkOut) {
    const lOut = new Date(employee.timeLeaveOut);
    mins = Math.max(0, mins - Math.floor((now.getTime() - lOut.getTime()) / 60000));
  }

  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  const formatted = `${h} س و ${m.toString().padStart(2, '0')} د`;

  return (
    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/40">
      {formatted}
    </span>
  );
};

const formatDisplayTime = (isoString?: string | null) => {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('ar-IQ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Baghdad'
  });
};

export default function LiveAttendanceBoard() {
  const { activeGovernorate } = useGovernorate();
  const { 
    allEmployees, 
    loading, 
    error, 
    refetch, 
    dutyInfo 
  } = useLiveAttendance(activeGovernorate);

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const printRef = useRef<HTMLDivElement>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Distinct departments list for filtering
  const departments = useMemo(() => {
    if (dutyInfo?.departments && dutyInfo.departments.length > 0) {
      return dutyInfo.departments;
    }
    const depts = new Set<string>();
    allEmployees.forEach(e => {
      if (e.departmentName && e.departmentName !== 'بدون قسم') depts.add(e.departmentName);
    });
    return Array.from(depts).sort().map(name => ({ id: name, name }));
  }, [dutyInfo, allEmployees]);

  // Status Badge Helper
  const getStatusConfig = (status: LiveEmployeeStatus) => {
    switch (status) {
      case 'working':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          dot: 'bg-emerald-500 animate-pulse',
          label: 'على رأس العمل'
        };
      case 'on_break':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
          dot: 'bg-amber-500',
          label: 'في استراحة / زمنية'
        };
      case 'checked_out':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          dot: 'bg-slate-400',
          label: 'أكمل دوامه (انصرف)'
        };
      case 'missing_checkout':
        return {
          bg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
          dot: 'bg-orange-500 animate-ping',
          label: 'معلق (لم يسجل خروج)'
        };
      case 'late':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
          dot: 'bg-rose-500',
          label: 'متأخر (على رأس العمل)'
        };
      case 'on_leave':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
          dot: 'bg-blue-500',
          label: 'مجاز برخصة رسمية'
        };
      case 'on_duty':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
          dot: 'bg-purple-500',
          label: 'واجب رسمي / إيفاد'
        };
      case 'upcoming_shift':
        return {
          bg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
          dot: 'bg-sky-400',
          label: 'بانتظار بدء المناوبة'
        };
      case 'absent':
      default:
        return {
          bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
          dot: 'bg-red-500',
          label: 'غائب غير مبرر'
        };
    }
  };

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return allEmployees.filter(emp => {
      // 1. Search Query
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || 
        emp.fullName?.toLowerCase().includes(q) ||
        emp.jobNumber?.toLowerCase().includes(q) ||
        emp.departmentName?.toLowerCase().includes(q) ||
        emp.liveStatusLabel?.toLowerCase().includes(q) ||
        emp.notes?.toLowerCase().includes(q);

      // 2. Department Filter
      const matchesDept = selectedDept === 'all' || 
        emp.departmentName === selectedDept || 
        emp.departmentId === selectedDept;

      // 3. Status Filter
      let matchesStatus = true;
      if (statusFilter === 'all') {
        matchesStatus = true;
      } else if (statusFilter === 'active_now') {
        matchesStatus = emp.liveStatus === 'working' || emp.liveStatus === 'on_break' || emp.liveStatus === 'late';
      } else if (statusFilter === 'checked_out') {
        matchesStatus = emp.liveStatus === 'checked_out';
      } else if (statusFilter === 'authorized') {
        matchesStatus = emp.liveStatus === 'on_leave' || emp.liveStatus === 'on_duty';
      } else if (statusFilter === 'late') {
        matchesStatus = emp.liveStatus === 'late' || (!!emp.checkIn && emp.liveStatusLabel.includes('متأخر'));
      } else if (statusFilter === 'absent') {
        matchesStatus = emp.liveStatus === 'absent';
      } else if (statusFilter === 'missing_checkout') {
        matchesStatus = emp.liveStatus === 'missing_checkout';
      } else if (statusFilter === 'upcoming_shift') {
        matchesStatus = emp.liveStatus === 'upcoming_shift';
      } else if (statusFilter === 'present_today') {
        matchesStatus = !!emp.checkIn;
      }

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [allEmployees, search, selectedDept, statusFilter]);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDept, statusFilter, pageSize]);

  // Paginated records
  const paginatedEmployees = useMemo(() => {
    if (pageSize === -1) return filteredEmployees;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(startIndex, startIndex + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredEmployees.length / pageSize) || 1;

  const handlePrint = () => {
    window.print();
  };

  if (loading && allEmployees.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-80 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <span className="text-sm font-bold text-slate-500">جاري تحميل بيانات الموقف الحي لدوام اليوم...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 text-rose-600 p-5 rounded-2xl border border-rose-200 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  // Fallback counters from dutyInfo
  const totalScheduled = dutyInfo?.totalScheduled ?? allEmployees.length;
  const totalPresent = dutyInfo?.totalPresent ?? allEmployees.filter(e => !!e.checkIn).length;
  const activeNow = dutyInfo?.activeNow ?? allEmployees.filter(e => e.liveStatus === 'working' || e.liveStatus === 'on_break' || e.liveStatus === 'late').length;
  const completedDuty = dutyInfo?.completedDuty ?? allEmployees.filter(e => e.liveStatus === 'checked_out').length;
  const missingCheckout = dutyInfo?.missingCheckout ?? allEmployees.filter(e => e.liveStatus === 'missing_checkout').length;
  const onLeaveCount = dutyInfo?.onLeaveCount ?? allEmployees.filter(e => e.liveStatus === 'on_leave').length;
  const onDutyCount = dutyInfo?.onDutyCount ?? allEmployees.filter(e => e.liveStatus === 'on_duty').length;
  const absentCount = dutyInfo?.absentCount ?? allEmployees.filter(e => e.liveStatus === 'absent').length;
  const lateCount = dutyInfo?.lateCount ?? allEmployees.filter(e => e.liveStatus === 'late').length;
  const upcomingShiftCount = dutyInfo?.upcomingShiftCount ?? allEmployees.filter(e => e.liveStatus === 'upcoming_shift').length;
  const coveragePercent = dutyInfo?.coveragePercent ?? Math.round(((totalPresent + onLeaveCount + onDutyCount) / (totalScheduled || 1)) * 100);

  return (
    <div className="space-y-6 print:space-y-4" ref={printRef}>
      
      {/* ─── Smart Header & Day Phase Banner ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-2xl border bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-lg relative overflow-hidden"
      >
        {/* Subtle background glow */}
        <div className="absolute -left-10 -top-10 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300 shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-extrabold text-lg text-white tracking-wide">
                  {dutyInfo?.dayTypeLabel || 'الموقف الحي لدوام اليوم'}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  {dutyInfo?.isHolidayOrWeekend ? 'مقتصر على كوادر المناوبة' : 'دوام كامل لجميع الأقسام'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {dutyInfo?.dayPhaseLabel || 'فترة العمل الحالية'}
                </span>
              </div>
              <p className="text-xs mt-1.5 text-slate-300 leading-relaxed max-w-2xl">
                {dutyInfo?.isHolidayOrWeekend ? (
                  <>عطلة رسمية — يقتصر الحضور على طواقم المناوبة والخفر المقيدين بجداول عمل خاصة.</>
                ) : (
                  <>
                    إجمالي القوة المكلفة بالدوام اليوم: <span className="font-bold text-white">{totalScheduled} موظفاً</span>
                    {' '}(باستثناء المناوبين في يوم استراحتهم الدورية).
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Coverage KPI Widget */}
          <div className="flex items-center gap-4 bg-white/10 dark:bg-slate-800/40 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-blue-200 font-medium">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>نسبة التغطية القانونية اليوم:</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{coveragePercent}%</span>
                <span className="text-[11px] text-slate-300">
                  ({totalPresent + onLeaveCount + onDutyCount} من {totalScheduled})
                </span>
              </div>
              <div className="w-40 bg-white/20 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, coveragePercent)}%` }}
                />
              </div>
            </div>

            <div className="border-r border-white/20 pr-4 flex flex-col gap-1.5">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="تحديث البيانات فوراً"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-300' : ''}`} />
              </button>
              <button
                onClick={handlePrint}
                title="طباعة تقرير الموقف اللحظي"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center print:hidden"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Executive KPI Cards (Interactive Filters) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* 1. Total Present */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => setStatusFilter(statusFilter === 'present_today' ? 'all' : 'present_today')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            statusFilter === 'present_today'
              ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 dark:bg-blue-950/40 dark:border-blue-500'
              : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold">حضروا اليوم</span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-1">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{totalPresent}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              {totalPresent - lateCount} بالوقت • {lateCount} بتأخير
            </p>
          </div>
        </motion.div>

        {/* 2. Active Now */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => setStatusFilter(statusFilter === 'active_now' ? 'all' : 'active_now')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            statusFilter === 'active_now'
              ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40 dark:border-emerald-500'
              : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-800/40 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
            <span className="text-xs font-bold">على رأس العمل الآن</span>
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <div className="mt-1">
            <span className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">{activeNow}</span>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 truncate">
              {dutyInfo?.dayPhase.includes('evening') || dutyInfo?.dayPhase.includes('night') ? 'مناوبات مستمرة' : 'متواجدون حالياً'}
            </p>
          </div>
        </motion.div>

        {/* 3. Completed Shift (Checked Out) */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => setStatusFilter(statusFilter === 'checked_out' ? 'all' : 'checked_out')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            statusFilter === 'checked_out'
              ? 'bg-slate-100 border-slate-500 ring-2 ring-slate-500/20 dark:bg-slate-700 dark:border-slate-400'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold">أكملوا وانصرفوا</span>
            <LogOut className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-1">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{completedDuty}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              بصمات خروج نظامية
            </p>
          </div>
        </motion.div>

        {/* 4. Missing Checkout (Pending Alert) */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => setStatusFilter(statusFilter === 'missing_checkout' ? 'all' : 'missing_checkout')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            statusFilter === 'missing_checkout'
              ? 'bg-orange-100 border-orange-500 ring-2 ring-orange-500/20 dark:bg-orange-950/60 dark:border-orange-400'
              : missingCheckout > 0 
                ? 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40 hover:border-orange-400'
                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-orange-700 dark:text-orange-400 mb-1">
            <span className="text-xs font-bold">معلق (بدون خروج)</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="mt-1">
            <span className="text-3xl font-extrabold text-orange-700 dark:text-orange-300">{missingCheckout}</span>
            <p className="text-[11px] text-orange-600/80 dark:text-orange-400/80 mt-1 truncate">
              انتهى دوامهم ولم يبصموا
            </p>
          </div>
        </motion.div>

        {/* 5. Authorized (Leaves & Duties) */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => setStatusFilter(statusFilter === 'authorized' ? 'all' : 'authorized')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            statusFilter === 'authorized'
              ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500/20 dark:bg-blue-950/60 dark:border-blue-400'
              : 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-100 dark:border-blue-800/40 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-1">
            <span className="text-xs font-bold">مأذونون (إجازات وواجب)</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="mt-1">
            <span className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">
              {onLeaveCount + onDutyCount}
            </span>
            <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-1 truncate">
              {onLeaveCount} إجازات • {onDutyCount} واجب رسمي
            </p>
          </div>
        </motion.div>

        {/* 6. Unexcused Absent */}
        <motion.div
          whileHover={{ y: -2 }}
          onClick={() => setStatusFilter(statusFilter === 'absent' ? 'all' : 'absent')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            statusFilter === 'absent'
              ? 'bg-red-100 border-red-500 ring-2 ring-red-500/20 dark:bg-red-950/60 dark:border-red-400'
              : 'bg-red-50/40 dark:bg-red-950/20 border-red-100 dark:border-red-800/40 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between text-red-700 dark:text-red-400 mb-1">
            <span className="text-xs font-bold">غياب غير مبرر</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="mt-1">
            <span className="text-3xl font-extrabold text-red-700 dark:text-red-300">{absentCount}</span>
            <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-1 truncate">
              بدون طلب إجازة أو مهمة
            </p>
          </div>
        </motion.div>

      </div>

      {/* ─── Control Bar: Search, Department Filter, Status Tabs & View Toggle ─── */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3.5 print:hidden">
        
        {/* Top Controls Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Universal Search Field */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="البحث بالاسم، الرقم الوظيفي، أو القسم..."
              className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Department Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                <option value="all">كافة الأقسام والشعب</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
                title="عرض الجدول التنفيذي"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">جدول تنفيذي</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
                title="عرض البطاقات"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">بطاقات</span>
              </button>
            </div>

            {/* Records Count Badge */}
            <div className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-bold border border-slate-200/60 dark:border-slate-700">
              المعروض: {filteredEmployees.length} من {totalScheduled}
            </div>
          </div>
        </div>

        {/* Filter Tabs Row */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-thin">
          {[
            { id: 'all', label: 'الكل', count: allEmployees.length },
            { id: 'active_now', label: 'على رأس العمل الآن', count: activeNow },
            { id: 'checked_out', label: 'أكملوا دوامهم (انصرفوا)', count: completedDuty },
            { id: 'authorized', label: 'مأذونون (إجازة/واجب)', count: onLeaveCount + onDutyCount },
            { id: 'late', label: 'متأخرون / جزاءات', count: lateCount },
            { id: 'missing_checkout', label: 'معلق (لم يسجل خروج)', count: missingCheckout },
            { id: 'upcoming_shift', label: 'بانتظار المناوبة', count: upcomingShiftCount },
            { id: 'absent', label: 'غياب غير مبرر', count: absentCount }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-2 ring-blue-500/20'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main Content: High-Density Table or Grid View ─── */}
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-extrabold select-none">
                  <th className="py-3.5 px-3 w-10 text-center">#</th>
                  <th className="py-3.5 px-3 min-w-[200px]">الموظف والرقم الوظيفي</th>
                  <th className="py-3.5 px-3 min-w-[140px]">القسم / الشعبة</th>
                  <th className="py-3.5 px-3 min-w-[120px]">جدول الدوام</th>
                  <th className="py-3.5 px-3 text-center min-w-[90px]">الحضور</th>
                  <th className="py-3.5 px-3 text-center min-w-[90px]">الانصراف</th>
                  <th className="py-3.5 px-3 text-center min-w-[100px]">ساعات التواجد</th>
                  <th className="py-3.5 px-3 text-center min-w-[140px]">الحالة المباشرة</th>
                  <th className="py-3.5 px-3 min-w-[180px]">الملاحظات والجزاءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {paginatedEmployees.map((emp, idx) => {
                  const cfg = getStatusConfig(emp.liveStatus);
                  const isPendingDevice = emp.isDevicePending;
                  const rowNumber = pageSize === -1 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr 
                      key={emp.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors ${
                        isPendingDevice ? 'bg-red-50/30 dark:bg-red-950/20' : ''
                      }`}
                    >
                      {/* # */}
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {rowNumber}
                      </td>

                      {/* Employee */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-xs shrink-0 border border-slate-200 dark:border-slate-600">
                            {emp.fullName?.charAt(0) || 'م'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 dark:text-white block truncate">
                              {emp.fullName}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {emp.jobNumber || 'بدون رقم وظيفي'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 text-xs">
                        <span className="truncate block max-w-[160px]" title={emp.departmentName}>
                          {emp.departmentName}
                        </span>
                      </td>

                      {/* Schedule Pattern */}
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                          {emp.shiftLabel}
                        </span>
                      </td>

                      {/* Check-in */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-xs">
                        {emp.checkIn ? (
                          <span className={emp.liveStatus === 'late' ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-800 dark:text-slate-200'}>
                            {formatDisplayTime(emp.checkIn)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">--:--</span>
                        )}
                      </td>

                      {/* Check-out */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-xs">
                        {emp.checkOut ? (
                          <span className="text-slate-800 dark:text-slate-200">
                            {formatDisplayTime(emp.checkOut)}
                          </span>
                        ) : emp.liveStatus === 'missing_checkout' ? (
                          <span className="text-orange-600 dark:text-orange-400 text-[10px] font-bold">لم يبصم</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">--:--</span>
                        )}
                      </td>

                      {/* Worked Duration */}
                      <td className="py-3 px-3 text-center">
                        <LiveDurationBadge employee={emp} />
                      </td>

                      {/* Live Status Badge */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cfg.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          <span>{cfg.label}</span>
                        </span>
                      </td>

                      {/* Notes / Details */}
                      <td className="py-3 px-3 text-xs">
                        {isPendingDevice ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            جهاز غير معتمد (معلق)
                          </span>
                        ) : emp.leaveInfo ? (
                          <span className="text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1 truncate" title={emp.leaveInfo.reason || ''}>
                            <FileCheck className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                            {emp.liveStatusLabel}
                            {emp.leaveInfo.destination ? ` (${emp.leaveInfo.destination})` : ''}
                          </span>
                        ) : emp.notes ? (
                          <span className="text-slate-500 dark:text-slate-400 truncate block max-w-[200px]" title={emp.notes}>
                            {emp.notes}
                          </span>
                        ) : emp.liveStatus === 'upcoming_shift' ? (
                          <span className="text-sky-600 dark:text-sky-400 text-[11px]">
                            الموعد المقرر: {emp.expectedStart}
                          </span>
                        ) : emp.liveStatus === 'absent' ? (
                          <span className="text-red-500 text-[11px] font-medium">
                            تخلف عن الحضور
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-[11px]">منتظم</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      <Filter className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm">لا توجد سجلات تطابق عوامل التصفية الحالية</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Bar */}
          {filteredEmployees.length > 0 && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium">
                <span>عرض</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 font-bold text-slate-700 dark:text-slate-200"
                >
                  <option value={25}>25 سجل</option>
                  <option value={50}>50 سجل</option>
                  <option value={100}>100 سجل</option>
                  <option value={-1}>عرض الكل ({filteredEmployees.length})</option>
                </select>
                <span>في الصفحة الواحدة</span>
              </div>

              {pageSize !== -1 && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="px-3 font-bold text-slate-700 dark:text-slate-300">
                    صفحة {currentPage} من {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ─── Grid View (Cards) ─── */
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedEmployees.map((emp) => {
            const cfg = getStatusConfig(emp.liveStatus);
            const isPendingDevice = emp.isDevicePending;

            return (
              <motion.div
                layout
                key={emp.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-white dark:bg-slate-800 rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between ${
                  isPendingDevice 
                    ? 'border-red-300 bg-red-50/20 dark:border-red-800 dark:bg-red-950/20' 
                    : 'border-slate-200/80 dark:border-slate-700'
                }`}
              >
                {/* Top status accent line */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                  emp.liveStatus === 'working' ? 'bg-emerald-500' :
                  emp.liveStatus === 'checked_out' ? 'bg-slate-400' :
                  emp.liveStatus === 'on_break' ? 'bg-amber-500' :
                  emp.liveStatus === 'missing_checkout' ? 'bg-orange-500' :
                  emp.liveStatus === 'late' ? 'bg-rose-500' :
                  emp.liveStatus === 'on_leave' ? 'bg-blue-500' :
                  emp.liveStatus === 'on_duty' ? 'bg-purple-500' :
                  emp.liveStatus === 'upcoming_shift' ? 'bg-sky-400' : 'bg-red-500'
                }`} />

                <div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-slate-600 text-sm">
                      {emp.fullName?.charAt(0) || 'م'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-slate-800 dark:text-white truncate text-sm">
                          {emp.fullName}
                        </h4>
                        {isPendingDevice && (
                          <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded shrink-0">
                            ⚠️ غير معتمد
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {emp.jobNumber || 'بدون رقم'} • {emp.departmentName}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">الجدول:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{emp.shiftLabel}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">وقت الدخول:</span>
                      <span className={`font-mono font-bold ${emp.liveStatus === 'late' ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {formatDisplayTime(emp.checkIn)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">وقت الانصراف:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {emp.checkOut ? formatDisplayTime(emp.checkOut) : emp.liveStatus === 'missing_checkout' ? 'لم يبصم' : '--:--'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400">ساعات التواجد:</span>
                      <LiveDurationBadge employee={emp} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${cfg.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <span>{cfg.label}</span>
                  </span>

                  {emp.leaveInfo ? (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold truncate max-w-[120px]">
                      {emp.liveStatusLabel}
                    </span>
                  ) : emp.liveStatus === 'upcoming_shift' ? (
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">
                      يبدأ {emp.expectedStart}
                    </span>
                  ) : null}
                </div>
              </motion.div>
            );
          })}

          {filteredEmployees.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              <Filter className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-sm">لا توجد سجلات تطابق عوامل التصفية الحالية</p>
            </div>
          )}
        </motion.div>
      )}

    </div>
  );
}
