import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileText,
  Send,
  Building2,
  DollarSign,
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
  const [includeNominal, setIncludeNominal] = useState(false);
  const [includeTotal, setIncludeTotal] = useState(false);
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

  // ── 2. Financial Data (Nominal & Net Salary) ─────────────────────────────────
  const nominalSalary = useMemo(() => {
    return Number(employeeData?.financialData?.nominal_salary || 0);
  }, [employeeData]);

  // الراتب الكلي بعد الاستقطاعات (الصافي)
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

  // اسم المستخدم المباشر دون كلمة "محترم"
  const employeeName = useMemo(() => {
    return user?.full_name?.trim() || (user as any)?.name?.trim() || user?.username || '';
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
    setShowConfirmModal(true);
  };

  const executeSubmit = async () => {
    if (!user?.id) {
      toast.error('يجب تسجيل الدخول لتقديم الطلب');
      return;
    }

    setIsSubmitting(true);
    const chosenEntity = destinationEntity.trim();

    try {
      // Execute atomic RPC call
      const { error: rpcError } = await supabase.rpc('submit_service_continuity_request', {
        p_destination_entity: chosenEntity,
        p_include_nominal_salary: includeNominal,
        p_include_total_salary: includeTotal,
        p_notes: notes.trim() || null,
      });

      if (rpcError) throw rpcError;

      // Accumulate the new entity into local pool & localStorage
      if (!knownEntities.includes(chosenEntity)) {
        const next = [...knownEntities, chosenEntity].sort((a, b) => a.localeCompare(b, 'ar'));
        setKnownEntities(next);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
        } catch {}
      }

      toast.success('تم إرسال طلب تأييد الاستمرارية بنجاح، وأُحيل إلى مسؤولك المباشر');
      setDestinationEntity('');
      setIncludeNominal(false);
      setIncludeTotal(false);
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
    switch (status) {
      case 'pending_supervisor':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock size={13} className="animate-pulse" />
            بانتظار موافقة المسؤول المباشر
          </span>
        );
      case 'pending_hr':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <ShieldCheck size={13} className="text-blue-500 animate-spin" />
            بانتظار إصدار وتوقيع الموارد البشرية
          </span>
        );
      case 'issued_and_dispatched':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Truck size={13} className="text-emerald-600 dark:text-emerald-400" />
            تم الإصدار والإرسال بالبريد الداخلي
          </span>
        );
      case 'rejected_by_supervisor':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle size={13} />
            مرفوض من المسؤول المباشر
          </span>
        );
      case 'rejected_by_hr':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle size={13} />
            تعذر الإصدار من الموارد البشرية
          </span>
        );
      default:
        return null;
    }
  };

  // Salary Clause Construction
  const salaryClause = useMemo(() => {
    if (includeNominal && includeTotal) {
      return `. ويتقاضى راتباً اسمياً قدره (${formatCurrency(nominalSalary)} د.ع) وراتباً كلياً قدره (${formatCurrency(netSalary)} د.ع)`;
    }
    if (includeNominal) {
      return `. ويتقاضى راتباً اسمياً قدره (${formatCurrency(nominalSalary)} د.ع)`;
    }
    if (includeTotal) {
      return `. ويتقاضى راتباً كلياً قدره (${formatCurrency(netSalary)} د.ع)`;
    }
    return '';
  }, [includeNominal, includeTotal, nominalSalary, netSalary]);

  const purposeClause = useMemo(() => {
    return cleanedPurpose ? `، لاغراض ${cleanedPurpose}` : '';
  }, [cleanedPurpose]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Main Form Card ── */}
      <div className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 bg-gradient-to-r from-cyan-50/50 via-sky-50/30 to-transparent dark:from-cyan-950/20 dark:via-sky-950/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 flex items-center justify-center font-bold shadow-sm">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">
                  طلب تأييد استمرارية بالخدمة
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  إصدار كتاب رسمي يثبت الاستمرار في الخدمة مع إمكانية تضمين تفاصيل الراتب
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-cyan-100/70 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 font-medium">
              <Truck size={13} />
              تسليم بالبريد الداخلي
            </span>
          </div>
        </div>

        <form onSubmit={handleOpenConfirm} className="p-5 space-y-5">
          {/* ── Destination Entity Input with Interactive Auto-filtering Dropdown ── */}
          <div className="space-y-2 relative" ref={dropdownRef}>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                الجهة المعنون إليها الكتاب <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                قائمة ذكية تتراكم آلياً
              </span>
            </div>

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
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all pl-10"
                required
                autoComplete="off"
              />
              <Building2 size={18} className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
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
                      className="w-full text-right px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center justify-between transition-colors border-b border-gray-100/60 dark:border-gray-750 last:border-b-0"
                    >
                      <span className="font-medium">{item}</span>
                      <Building2 size={13} className="text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Salary Options ── */}
          <div className="bg-gray-50/70 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200/60 dark:border-gray-700/50 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
              <DollarSign size={15} className="text-emerald-500" />
              خيارات تضمين بيانات الراتب في نص الكتاب
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Nominal Salary Checkbox */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  includeNominal
                    ? 'bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-700 shadow-xs'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={includeNominal}
                  onChange={(e) => setIncludeNominal(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-cyan-600 rounded-sm border-gray-300 focus:ring-cyan-500"
                />
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-gray-800 dark:text-gray-200">
                    تضمين الراتب الاسمي
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    الراتب المعتمد في السجل:{' '}
                    <span className="font-bold text-cyan-700 dark:text-cyan-300 font-mono">
                      {isLoadingProfile ? '...' : `${formatCurrency(nominalSalary)} د.ع`}
                    </span>
                  </div>
                </div>
              </label>

              {/* Net Salary Checkbox */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  includeTotal
                    ? 'bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-700 shadow-xs'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={includeTotal}
                  onChange={(e) => setIncludeTotal(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-cyan-600 rounded-sm border-gray-300 focus:ring-cyan-500"
                />
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-gray-800 dark:text-gray-200">
                    تضمين الراتب الكلي (الصافي)
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    الراتب الصافي المعتمد:{' '}
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                      {isLoadingProfile ? '...' : `${formatCurrency(netSalary)} د.ع`}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* ── Optional Purpose / Notes Field ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                ملاحظات إضافية أو غرض خاص (اختياري)
              </label>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                يُدمج تلقائياً في نص الكتاب بعبارة «لاغراض ...»
              </span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="مثال: كفالة السيد محمد علي، شراء وحدة سكنية، التقديم على دراسات عليا..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 text-xs focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all resize-none"
            />
          </div>

          {/* ── Official Letter Live Preview Card ── */}
          <div className="border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 rounded-2xl p-4.5 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-sky-100 dark:border-sky-900/40 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-sky-300">
                <Sparkles size={15} className="text-sky-600 dark:text-sky-400" />
                معاينة حية لشكل الكتاب الرسمي الصادر
              </div>
              <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                الصيغة الرسمية المعتمدة
              </span>
            </div>

            {/* Letter Content Preview */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200/90 dark:border-gray-700 shadow-xs text-right space-y-4 leading-relaxed">
              {/* Letter Header */}
              <div className="flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-2.5">
                <div>العدد: ت أ / قيد الإصدار</div>
                <div className="font-bold text-gray-700 dark:text-gray-300">
                  وزارة الاتصالات • مديرية اتصالات ومعلوماتية كربلاء المقدسة
                </div>
                <div>التاريخ: {new Date().toLocaleDateString('ar-EG')}</div>
              </div>

              {/* Destination */}
              <div className="font-bold text-xs text-gray-800 dark:text-gray-100 pt-1">
                إلى / {destinationEntity.trim() || 'الجهة المعنية'}
              </div>

              {/* Subject */}
              <div className="font-bold text-xs text-center text-cyan-800 dark:text-cyan-400 underline decoration-cyan-400/50 underline-offset-4">
                م / تأييد استمرارية بالخدمة
              </div>

              {/* Body */}
              <div className="text-xs text-gray-700 dark:text-gray-300 leading-loose text-justify">
                نؤيد لكم ان السيد/السيدة{' '}
                <span className="font-bold text-gray-900 dark:text-white underline decoration-dotted">
                  {employeeName || 'الموظف'}
                </span>{' '}
                احد موظفينا على الملاك الدائم ومستمر بالخدمة في الوقت الحاضر
                {salaryClause}
                {purposeClause}. وزود بهذا التأييد حسب طلبه. للتفضل بالاطلاع مع التقدير.
              </div>

              {/* Footer Signatures */}
              <div className="pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                {/* Authority note */}
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>يصدر أصولياً بتوقيع السيد المدير او من يخوله</span>
                </div>

                {/* Director Signature Block (centered with each other on the left side) */}
                <div className="flex flex-col items-center text-center font-bold text-gray-800 dark:text-gray-100 space-y-0.5 leading-snug">
                  <div className="text-[12px] text-gray-600 dark:text-gray-400 font-semibold">الدكتور المهندس</div>
                  <div className="text-sm font-extrabold text-gray-900 dark:text-white">د. علي عباس جاسم الصباغ</div>
                  <div className="text-[11px] text-cyan-800 dark:text-cyan-300">مدير مديرية اتصالات ومعلوماتية</div>
                  <div className="text-[11px] text-gray-600 dark:text-gray-400">كربلاء المقدسة</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Workflow Steps Explanation Banner with (ثم) ── */}
          <div className="bg-cyan-50/50 dark:bg-cyan-950/20 rounded-xl p-3 border border-cyan-100 dark:border-cyan-900/40 text-xs text-cyan-800 dark:text-cyan-300 flex items-start gap-2.5">
            <Info size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">مسار التدقيق والإصدار الآلي:</div>
              <div className="text-[11px] text-cyan-700/90 dark:text-cyan-300/80 leading-normal">
                1. يتوجه الطلب لمسؤولك المباشر للموافقة <strong className="text-cyan-900 dark:text-cyan-200 mx-1">(ثم)</strong> 2. يحال تلقائياً إلى الموارد البشرية لإصدار وتوقيع الكتاب <strong className="text-cyan-900 dark:text-cyan-200 mx-1">(ثم)</strong> 3. يرسل الكتاب الورقي الأصلي بالبريد الداخلي إلى موقع عملك دون الحاجة لمراجعة المديرية بنفسك.
              </div>
            </div>
          </div>

          {/* Submit Trigger */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !destinationEntity.trim()}
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
                <h4 className="font-bold text-base text-gray-800 dark:text-gray-100">
                  تأكيد إرسال طلب التأييد
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  يرجى تدقيق البيانات قبل الإحالة للمسؤول المباشر
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs bg-gray-50 dark:bg-gray-750 p-4 rounded-xl border border-gray-200/70 dark:border-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">اسم الموظف:</span>
                <span className="font-bold text-gray-800 dark:text-gray-100">{employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">الجهة المعنون إليها:</span>
                <span className="font-bold text-cyan-700 dark:text-cyan-300">{destinationEntity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">الراتب الاسمي:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {includeNominal ? `${formatCurrency(nominalSalary)} د.ع` : 'غير متضمن'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">الراتب الصافي:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {includeTotal ? `${formatCurrency(netSalary)} د.ع` : 'غير متضمن'}
                </span>
              </div>
              {cleanedPurpose && (
                <div className="pt-1 border-t border-gray-250 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 block mb-0.5">الغرض المطلوب:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
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
                className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-600/20"
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
                className="py-2.5 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-semibold transition-all"
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
            <Clock size={18} className="text-gray-500 dark:text-gray-400" />
            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">
              سجل طلباتي السابقة لتأييد الاستمرارية
            </h4>
          </div>
          <button
            type="button"
            onClick={loadRequests}
            disabled={isLoadingHistory}
            className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            title="تحديث السجل"
          >
            <RefreshCw size={15} className={isLoadingHistory ? 'animate-spin' : ''} />
          </button>
        </div>

        {isLoadingHistory ? (
          <div className="py-8 flex justify-center items-center text-gray-400 gap-2 text-xs">
            <Loader2 size={18} className="animate-spin text-cyan-600" />
            جاري تحميل سجل الطلبات...
          </div>
        ) : myRequests.length === 0 ? (
          <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
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
                  <div className="font-bold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                    <Building2 size={15} className="text-cyan-600" />
                    {req.destination_entity}
                  </div>
                  {renderStatusBadge(req.status)}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} />
                    {new Date(req.created_at).toLocaleDateString('ar-EG')}
                  </span>
                  {req.include_nominal_salary && (
                    <span className="text-cyan-700 dark:text-cyan-300">
                      اسمي: {formatCurrency(req.nominal_salary_snapshot)} د.ع
                    </span>
                  )}
                  {req.include_total_salary && (
                    <span className="text-emerald-700 dark:text-emerald-300">
                      صافي: {formatCurrency(req.total_salary_snapshot)} د.ع
                    </span>
                  )}
                  {req.notes && (
                    <span className="text-gray-600 dark:text-gray-300">
                      الغرض: {req.notes}
                    </span>
                  )}
                </div>

                {/* Issued Details Banner */}
                {req.status === 'issued_and_dispatched' && req.official_letter_number && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash size={14} className="text-emerald-600" />
                      <span>
                        الكتاب الصادر برقم: <strong>{req.official_letter_number}</strong>
                      </span>
                      {req.official_letter_date && (
                        <span>بتاريخ: {req.official_letter_date}</span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      مرسل بالبريد الداخلي 📦
                    </span>
                  </div>
                )}

                {/* Rejection Notes */}
                {(req.status === 'rejected_by_supervisor' || req.status === 'rejected_by_hr') && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
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
