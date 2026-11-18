import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Send,
  Building2,
  Clock,
  AlertCircle,
  XCircle,
  Truck,
  Loader2,
  RefreshCw,
  Sparkles,
  Info,
  Calendar,
  Hash,
  ShieldCheck,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { useEmployeeData } from '../../../hooks/useEmployeeData';

interface Props {
  onSuccess?: () => void;
}

interface ContinuityRequestRecord {
  id: string;
  destination_entity: string;
  include_nominal_salary: boolean;
  include_total_salary: boolean;
  nominal_salary_snapshot: number;
  total_salary_snapshot: number;
  gross_salary_snapshot?: number;
  notes?: string;
  status: 'pending_supervisor' | 'rejected_by_supervisor' | 'pending_hr' | 'rejected_by_hr' | 'issued_and_dispatched';
  supervisor_decision_at?: string;
  supervisor_notes?: string;
  hr_decision_at?: string;
  hr_notes?: string;
  official_letter_number?: string;
  official_letter_date?: string;
  created_at: string;
}

const DEFAULT_ENTITIES = [
  'دائرة التقاعد والضمان الاجتماعي',
  'صندوق الإسكان العراقي',
  'كليات وجامعات التعليم العالي',
  'مديرية المرور',
  'المصرف العقاري',
  'مصرف الرافدين',
  'مصرف الرشيد',
  'نقابة المهندسين العراقيين',
];

const LOCAL_STORAGE_KEY = 'continuity_custom_destinations';

const formatCurrency = (amount: number | string | undefined | null) => {
  const num = Number(amount || 0);
  return Math.round(num).toLocaleString('en-US');
};

export const ServiceContinuityRequestForm: React.FC<Props> = ({ onSuccess }) => {
  const { user } = useAuth();
  const { data: employeeData, isLoading: isLoadingProfile } = useEmployeeData(user?.id);

  // Form State
  const [destinationEntity, setDestinationEntity] = useState('');
  const [includeSalaryDetails, setIncludeSalaryDetails] = useState(false);
  const [notes, setNotes] = useState('');

  // Dropdown & Search State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [knownEntities, setKnownEntities] = useState<string[]>(DEFAULT_ENTITIES);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [myRequests, setMyRequests] = useState<ContinuityRequestRecord[]>([]);

  // ── 1. Fetch & Accumulate Entities ──────────────────────────────────────────
  useEffect(() => {
    let savedLocal: string[] = [];
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) savedLocal = JSON.parse(raw);
    } catch {}

    const pool = new Set([...DEFAULT_ENTITIES, ...savedLocal]);

    const initEntities = async () => {
      try {
        const { data } = await supabase
          .from('service_continuity_requests')
          .select('destination_entity')
          .not('destination_entity', 'is', null)
          .limit(100);

        if (data) {
          data.forEach((r: any) => {
            if (r.destination_entity?.trim()) {
              pool.add(r.destination_entity.trim());
            }
          });
        }
      } catch (err) {
        console.warn('Notice loading destinations:', err);
      } finally {
        setKnownEntities(Array.from(pool).sort((a, b) => a.localeCompare(b, 'ar')));
      }
    };

    initEntities();
  }, []);

  // Filtered entities based on what the user types
  const filteredEntities = useMemo(() => {
    const q = destinationEntity.trim();
    if (!q) return knownEntities;
    return knownEntities.filter((e) => e.includes(q));
  }, [destinationEntity, knownEntities]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── 2. Financial Data (Nominal, Gross & Net Salary) ─────────────────────────
  const nominalSalary = useMemo(() => {
    return Number(employeeData?.financialData?.nominal_salary || 0);
  }, [employeeData]);

  // الراتب الكلي (الإجمالي)
  const grossSalary = useMemo(() => {
    return Number(employeeData?.financialData?.gross_salary || 0);
  }, [employeeData]);

  // الراتب الصافي بعد الاستقطاعات
  const netSalary = useMemo(() => {
    const fin = employeeData?.financialData;
    return Number(fin?.net_salary || fin?.gross_salary || fin?.nominal_salary || 0);
  }, [employeeData]);

  // ── 3. Clean Purpose & Smart Phrasing ────────────────────────────────────────
  // تنظيف النص وحذف أي صيغ مكررة لـ (لأغراض / لغرض / بغرض)
  const cleanedPurpose = useMemo(() => {
    if (!notes.trim()) return '';
    return notes.trim().replace(/^(لأغراض|لاغراض|لغرض|بغرض|غرض)\s+/i, '').trim();
  }, [notes]);

  // اسم المستخدم المباشر (ثلاثي وفق الضوابط الرسمية ومراعاة الأسماء المركبة)
  const employeeName = useMemo(() => {
    const rawName = user?.full_name?.trim() || (user as any)?.name?.trim() || user?.username || '';
    if (!rawName) return '';
    const words = rawName.split(/\s+/).filter(Boolean);
    const nameTokens: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const current = words[i];
      if (/^(عبد|أمة|امه)$/i.test(current) && i + 1 < words.length) {
        nameTokens.push(`${current} ${words[i + 1]}`);
        i++;
      } else {
        nameTokens.push(current);
      }
      if (nameTokens.length === 3) break;
    }
    return nameTokens.join(' ');
  }, [user]);

  // ── 4. Load Previous Requests ───────────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('service_continuity_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Notice loading service_continuity_requests:', error.message);
      } else {
        setMyRequests((data as ContinuityRequestRecord[]) || []);
      }
    } catch (err) {
      console.warn('Error loading requests:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // ── 5. Submit Execution ─────────────────────────────────────────────────────
  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationEntity.trim()) {
      toast.error('يرجى تحديد الجهة المعنون إليها الكتاب');
      return;
    }
    if (!notes.trim()) {
      toast.error('يجب وضع غرض للكتاب');
      return;
    }
    setShowConfirmModal(true);
  };

  const executeSubmit = async () => {
    if (!user?.id) {
      toast.error('يجب تسجيل الدخول لتقديم الطلب');
      return;
    }

    if (!destinationEntity.trim()) {
      toast.error('يرجى تحديد الجهة المعنون إليها الكتاب');
      return;
    }

    if (!notes.trim()) {
      toast.error('يجب وضع غرض للكتاب');
      setShowConfirmModal(false);
      return;
    }

    setIsSubmitting(true);
    const chosenEntity = destinationEntity.trim();

    try {
      // Execute atomic RPC call
      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_service_continuity_request', {
        p_destination_entity: chosenEntity,
        p_include_nominal_salary: includeSalaryDetails,
        p_include_total_salary: includeSalaryDetails,
        p_notes: notes.trim(),
      });

      if (rpcError) throw rpcError;

      const res = rpcData as any;
      if (res?.status === 'no_manager_available') {
        toast.error(res?.message || 'يرجى مراجعة الادارة بنفسك لتمشية الطلب لعدم توفر مسؤول في الوقت الحالي', { duration: 6000 });
        setShowConfirmModal(false);
        loadRequests();
        return;
      }

      // Accumulate the new entity into local pool & localStorage
      if (!knownEntities.includes(chosenEntity)) {
        const next = [...knownEntities, chosenEntity].sort((a, b) => a.localeCompare(b, 'ar'));
        setKnownEntities(next);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
        } catch {}
      }

      toast.success(res?.message || 'تم إرسال طلب تأييد الاستمرارية بنجاح، وأُحيل إلى مسؤول القسم المالي والإداري وبديله للاعتماد');
      setDestinationEntity('');
      setIncludeSalaryDetails(false);
      setNotes('');
      setShowConfirmModal(false);
      loadRequests();
      onSuccess?.();
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error(err.message || 'حدث خطأ أثناء تقديم الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: ContinuityRequestRecord['status']) => {
    switch (status as any) {
      case 'pending_finance':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
            <Clock size={13} className="animate-pulse" />
            بانتظار موافقة مسؤول القسم المالي والإداري
          </span>
        );
      case 'pending_print':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-700">
            <ShieldCheck size={13} className="text-cyan-600" />
            معتمد وبانتظار الطباعة والإصدار
          </span>
        );
      case 'completed':
      case 'issued_and_dispatched':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
            <Truck size={13} className="text-emerald-600 dark:text-emerald-400" />
            تم الإصدار والإرسال بالبريد الداخلي
          </span>
        );
      case 'rejected_by_finance':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
            <XCircle size={13} />
            مرفوض من القسم المالي والإداري
          </span>
        );
      case 'no_manager_available':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100 border border-amber-400">
            <XCircle size={13} />
            يرجى مراجعة الإدارة بنفسك
          </span>
        );
      case 'pending_supervisor':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
            <Clock size={13} className="animate-pulse" />
            بانتظار موافقة المسؤول المباشر
          </span>
        );
      case 'pending_hr':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
            <ShieldCheck size={13} className="text-blue-600" />
            بانتظار إصدار وتوقيع الموارد البشرية
          </span>
        );
      case 'rejected_by_supervisor':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
            <XCircle size={13} />
            مرفوض من المسؤول المباشر
          </span>
        );
      case 'rejected_by_hr':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
            <XCircle size={13} />
            تعذر الإصدار من الموارد البشرية
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Main Form Card ── */}
      <div className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
        <form onSubmit={handleOpenConfirm} className="p-5 sm:p-6 space-y-5">
          {/* ── Destination Entity Input with Interactive Auto-filtering Dropdown ── */}
          <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
              الجهة المعنون إليها الكتاب <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <input
                type="text"
                value={destinationEntity}
                onChange={(e) => {
                  setDestinationEntity(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="مثال: مصرف الرافدين / فرع كربلاء، صندوق الإسكان، نقابة المهندسين..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/60 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all pl-10 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium"
                required
                autoComplete="off"
              />
              <Building2 size={18} className="absolute left-3 top-3 text-slate-500 dark:text-slate-400" />
            </div>

            {/* Dropdown Menu: 5 lines visible with scroll, hides if no results */}
            {isDropdownOpen && filteredEntities.length > 0 && (
              <div className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="py-1">
                  {filteredEntities.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDestinationEntity(item);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-right px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:text-cyan-800 dark:hover:text-cyan-200 flex items-center justify-between transition-colors border-b border-gray-100 dark:border-gray-750 last:border-b-0"
                    >
                      <span className="font-semibold">{item}</span>
                      <Building2 size={13} className="text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Salary Details Option (المستطيل المعتمد لتضمين تفاصيل الراتب) ── */}
          <label
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              includeSalaryDetails
                ? 'bg-cyan-50/90 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-700 shadow-xs'
                : 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={includeSalaryDetails}
              onChange={(e) => setIncludeSalaryDetails(e.target.checked)}
              className="mt-1 w-4 h-4 text-cyan-600 rounded-sm border-gray-300 focus:ring-cyan-500 cursor-pointer shrink-0"
            />
            <div className="flex-1 space-y-1 overflow-hidden">
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                تضمين تفاصيل الراتب
              </div>
              <div className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed truncate">
                الكلي:{' '}
                <span className="font-bold font-mono text-cyan-800 dark:text-cyan-300">
                  {isLoadingProfile ? '...' : formatCurrency(grossSalary)}
                </span>
                {'  '}،{'  '}
                الصافي:{' '}
                <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  {isLoadingProfile ? '...' : formatCurrency(netSalary)}
                </span>
                {'  '}،{'  '}
                الاسمي:{' '}
                <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                  {isLoadingProfile ? '...' : formatCurrency(nominalSalary)}
                </span>
              </div>
            </div>
          </label>

          {/* ── Required Purpose Field ── */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap flex items-center gap-1.5">
                <span>الغرض من الكتاب</span>
                <span className="text-rose-500 font-extrabold">*</span>
                <span className="text-[11px] font-semibold text-rose-500 dark:text-rose-400">(إجباري)</span>
              </label>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                يُدمج تلقائياً في نص الكتاب
              </span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="مثال: كفالة السيد محمد علي، شراء وحدة سكنية، التقديم على دراسات عليا..."
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-gray-700/60 text-gray-900 dark:text-gray-100 text-xs sm:text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all resize-none placeholder:text-slate-400 font-medium ${
                !notes.trim() ? 'border-amber-300 dark:border-amber-600/60' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
          </div>

          {/* ── Official Letter Live Preview Card ── */}
          <div className="border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 rounded-2xl p-4 sm:p-5 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-sky-100 dark:border-sky-900/40 pb-2.5">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-sky-900 dark:text-sky-300">
                <Sparkles size={16} className="text-sky-600 dark:text-sky-400" />
                معاينة حية لشكل الكتاب الرسمي الصادر
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                الصيغة الرسمية المعتمدة
              </span>
            </div>

            {/* Letter Content Preview */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200/90 dark:border-gray-700 shadow-xs text-right space-y-4 leading-relaxed">
              {/* Letter Header */}
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-gray-200 dark:border-gray-800 pb-2.5">
                <div>العدد: ت أ / قيد الإصدار</div>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  وزارة الاتصالات • مديرية اتصالات ومعلوماتية كربلاء المقدسة
                </div>
                <div>التاريخ: {new Date().toLocaleDateString('ar-EG')}</div>
              </div>

              {/* Destination */}
              <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 pt-1">
                إلى / {destinationEntity.trim() || 'الجهة المعنية'}
              </div>

              {/* Subject */}
              <div className="font-bold text-xs sm:text-sm text-center text-cyan-800 dark:text-cyan-400 underline decoration-cyan-400/50 underline-offset-4">
                م / تأييد استمرارية بالخدمة
              </div>

              {/* Body */}
              <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-loose text-justify font-medium">
                نؤيد لكم ان السيد/السيدة{' '}
                <span className="font-bold text-slate-950 dark:text-white underline decoration-dotted">
                  {employeeName || 'الموظف'}
                </span>{' '}
                احد منتسبي هذه المديرية على الملاك الدائم ومستمر بالخدمة في الوقت الحاضر وبناءً على طلبه زُوّد بهذا التأييد
                {cleanedPurpose ? ` وذلك لغرض (${cleanedPurpose}).` : '.'}
              </div>

              {/* ... مع التقدير ... (في الوسط بولد في سطر منعزل) */}
              <div className="text-center font-extrabold text-sm sm:text-base text-slate-900 dark:text-white my-2 tracking-wide">
                ... مع التقدير ...
              </div>

              {/* تصنيفات الراتب على اليمين بثلاثة أسطر (عند تفعيل خيار تضمين تفاصيل الراتب) */}
              {includeSalaryDetails && (
                <div className="my-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-right space-y-1 animate-in fade-in duration-200">
                  <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                    علماً أن:
                  </div>
                  <div className="pr-3 space-y-1 text-xs sm:text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-3">
                      <span className="min-w-[95px] font-bold text-slate-900 dark:text-white">الراتب الاسمي /</span>
                      <span className="font-mono font-bold">{formatCurrency(nominalSalary)}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">دينار</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="min-w-[95px] font-bold text-slate-900 dark:text-white">الراتب الكلي /</span>
                      <span className="font-mono font-bold text-cyan-800 dark:text-cyan-300">{formatCurrency(grossSalary)}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">دينار</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="min-w-[95px] font-bold text-slate-900 dark:text-white">الراتب الصافي /</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(netSalary)}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">دينار</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Signatures */}
              <div className="pt-4 flex flex-row items-end justify-between gap-2 border-t border-gray-200 dark:border-gray-800 text-xs w-full">
                {/* Authority note (اليمين أسفل المعاينة) */}
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400 font-bold text-[11px] sm:text-xs">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>يصدر أصولياً بتوقيع السيد المدير او من يخوله</span>
                </div>

                {/* Director Signature Block (اليسار أسفل المعاينة) */}
                <div className="flex flex-col items-center text-center font-bold text-slate-800 dark:text-slate-100 space-y-0.5 leading-snug shrink-0">
                  <div className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400">الدكتور المهندس</div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">د. علي عباس جاسم الصباغ</div>
                  <div className="text-[10px] sm:text-xs text-cyan-800 dark:text-cyan-300 font-semibold">مدير اتصالات ومعلوماتية</div>
                  <div className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">كربلاء المقدسة</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Workflow Steps Explanation Banner (النقاط الثلاث بدون كلمة ثم) ── */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 flex items-start gap-2.5">
            <Info size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">مسار التدقيق والإصدار الآلي:</div>
              <div className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                1 - يتوجه الطلب لمسؤول القسم المالي والإداري لاستحصال الموافقة. 2 - يتم إكمال التواقيع الرسمية وإصدار الكتاب. 3 - يرسل الكتاب الورقي الأصلي بالبريد الداخلي إلى موقع عملك دون الحاجة لمراجعة المديرية بنفسك.
              </div>
            </div>
          </div>

          {/* Submit Trigger */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold text-sm shadow-md shadow-cyan-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send size={18} />
              تقديم ومراجعة طلب التأييد
            </button>
          </div>
        </form>
      </div>

      {/* ── Confirmation Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 shadow-2xl p-6 space-y-4 text-right">
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 flex items-center justify-center font-bold">
                <CheckCircle size={22} />
              </div>
              <div>
                <h4 className="font-bold text-base text-gray-900 dark:text-gray-100">
                  تأكيد إرسال طلب التأييد
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  يرجى تدقيق البيانات قبل الإحالة إلى القسم المالي والاداري
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs sm:text-[13px] bg-gray-50 dark:bg-gray-750 p-4 rounded-xl border border-gray-200/70 dark:border-gray-700 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">اسم الموظف:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">الجهة المعنون إليها:</span>
                <span className="font-bold text-cyan-700 dark:text-cyan-300">{destinationEntity}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-600 dark:text-slate-400">تفاصيل الراتب:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-left">
                  {includeSalaryDetails
                    ? `الكلي: ${formatCurrency(grossSalary)} | الصافي: ${formatCurrency(netSalary)} | الاسمي: ${formatCurrency(nominalSalary)} د.ع`
                    : 'غير متضمنة'}
                </span>
              </div>
              {cleanedPurpose && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-slate-600 dark:text-slate-400 block mb-0.5">الغرض المطلوب:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">
                    لاغراض {cleanedPurpose}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={executeSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-600/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    تأكيد وإرسال الطلب
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="py-2.5 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs sm:text-sm font-semibold transition-all"
              >
                تراجع وتعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── My Requests History Section ── */}
      <div className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/60 pb-3">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-slate-600 dark:text-slate-400" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              سجل طلباتي السابقة لتأييد الاستمرارية
            </h4>
          </div>
          <button
            type="button"
            onClick={loadRequests}
            disabled={isLoadingHistory}
            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            title="تحديث السجل"
          >
            <RefreshCw size={15} className={isLoadingHistory ? 'animate-spin' : ''} />
          </button>
        </div>

        {isLoadingHistory ? (
          <div className="py-8 flex justify-center items-center text-slate-500 gap-2 text-xs font-medium">
            <Loader2 size={18} className="animate-spin text-cyan-600" />
            جاري تحميل سجل الطلبات...
          </div>
        ) : myRequests.length === 0 ? (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
            لا توجد طلبات تأييد استمرارية سابقة لك.
          </div>
        ) : (
          <div className="space-y-3">
            {myRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-gray-200/80 dark:border-gray-700/70 bg-gray-50/50 dark:bg-gray-750 space-y-2.5 transition-all hover:border-cyan-300 dark:hover:border-cyan-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Building2 size={15} className="text-cyan-600" />
                    {req.destination_entity}
                  </div>
                  {renderStatusBadge(req.status)}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} />
                    {new Date(req.created_at).toLocaleDateString('ar-EG')}
                  </span>
                  {(req.include_nominal_salary || req.include_total_salary) && (
                    <span className="text-cyan-800 dark:text-cyan-300 font-mono">
                      تفاصيل الراتب متضمنة
                    </span>
                  )}
                  {req.notes && (
                    <span className="text-slate-700 dark:text-slate-200">
                      الغرض: {req.notes}
                    </span>
                  )}
                </div>

                {/* Issued Details Banner */}
                {req.status === 'issued_and_dispatched' && req.official_letter_number && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between font-medium">
                    <div className="flex items-center gap-2">
                      <Hash size={14} className="text-emerald-600" />
                      <span>
                        الكتاب الصادر برقم: <strong>{req.official_letter_number}</strong>
                      </span>
                      {req.official_letter_date && (
                        <span>بتاريخ: {req.official_letter_date}</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      مرسل بالبريد الداخلي 📦
                    </span>
                  </div>
                )}

                {/* Rejection Notes */}
                {(req.status === 'rejected_by_supervisor' || req.status === 'rejected_by_hr') && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-900 dark:text-rose-200 flex items-center gap-2 font-medium">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>سبب الرفض: {req.supervisor_notes || req.hr_notes || 'لم يُحدد سبب'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceContinuityRequestForm;
