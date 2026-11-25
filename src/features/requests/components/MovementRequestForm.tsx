import React, { useState, useEffect } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileText, Loader2, Calendar, Hash, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { DateInput } from '../../../components/ui/DateInput';
import { toast } from 'react-hot-toast';

interface MovementRequestFormProps {
  movementType: 'disengagement' | 'resumption';
  onSuccess?: () => void;
}

const MovementRequestForm: React.FC<MovementRequestFormProps> = ({ movementType, onSuccess }) => {
  const { user } = useAuth();
  const isDisengagement = movementType === 'disengagement';
  const titleLabel = isDisengagement ? 'انفكاك' : 'مباشرة';
  const dateFieldLabel = isDisengagement ? 'تاريخ الانفكاك' : 'تاريخ المباشرة';

  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveOrderNumber, setLeaveOrderNumber] = useState('');
  const [leaveOrderDate, setLeaveOrderDate] = useState('');
  const [withPay, setWithPay] = useState(true);
  const [linkedLeaveId, setLinkedLeaveId] = useState<string | null>(null);
  const [linkedLeaveInfo, setLinkedLeaveInfo] = useState<{ days_count: number; with_pay: boolean } | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    const loadActiveLongLeave = async () => {
      const q = supabase
        .from('leave_requests')
        .select('id, days_count, with_pay, start_date, hr_cut_status')
        .eq('user_id', user.id)
        .eq('leave_type', 'long_regular')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data } = await q;
      if (!mounted || !data || data.length === 0) return;

      const target = isDisengagement
        ? data.find((r: any) => !r.start_date) || data[0]
        : data.find((r: any) => r.start_date && r.hr_cut_status !== 'approved') || data[0];

      if (target) {
        setLinkedLeaveId(target.id);
        setLinkedLeaveInfo({ days_count: target.days_count, with_pay: target.with_pay !== false });
        setWithPay(target.with_pay !== false);
      }
    };
    loadActiveLongLeave();
    return () => {
      mounted = false;
    };
  }, [user?.id, isDisengagement]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الملف يتجاوز 5 ميجابايت');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${user.id}/${movementType}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('leave-order-attachments')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage
        .from('leave-order-attachments')
        .getPublicUrl(filePath);

      setAttachmentUrl(pub.publicUrl);
      toast.success('تم رفع صورة كتاب الإجازة بنجاح');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err?.message || 'فشل رفع صورة الكتاب');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!effectiveDate) {
      setError(`يرجى تحديد ${dateFieldLabel}`);
      return;
    }
    if (!leaveOrderNumber.trim()) {
      setError('يرجى إدخال رقم كتاب الإجازة');
      return;
    }
    if (!leaveOrderDate) {
      setError('يرجى تحديد تاريخ إصدار أمر الإجازة');
      return;
    }
    if (!attachmentUrl) {
      setError('تحميل صورة كتاب الإجازة إلزامي لإتمام الطلب');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('submit_hr_movement_request', {
        p_movement_type: movementType,
        p_effective_date: effectiveDate,
        p_leave_order_number: leaveOrderNumber.trim(),
        p_leave_order_date: leaveOrderDate,
        p_attachment_url: attachmentUrl,
        p_with_pay: withPay,
        p_linked_leave_id: linkedLeaveId,
      });

      if (rpcErr) throw rpcErr;
      const res = data as any;
      if (!res?.success) {
        setError(res?.message || 'تعذر إرسال الطلب');
        return;
      }

      setSuccess(true);
      toast.success(res.message || `تم إرسال طلب الـ${titleLabel} بنجاح`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Submit movement error:', err);
      setError(err?.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center space-y-3 animate-in fade-in duration-200">
        <div className="w-14 h-14 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={28} className="text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-bold text-green-800 dark:text-green-300">
          تم إرسال طلب {titleLabel} بنجاح
        </h3>
        <p className="text-sm text-green-700 dark:text-green-400">
          تم توجيه الطلب مع صورة كتاب الإجازة إلى مسؤول القسم المالي والإداري وبديله للموافقة وإصدار الأمر الإداري.
        </p>
        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            setLeaveOrderNumber('');
            setLeaveOrderDate('');
            setAttachmentUrl('');
          }}
          className="bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 transition font-bold text-sm"
        >
          تقديم طلب جديد
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-slate-700">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${
          isDisengagement ? 'bg-gradient-to-br from-indigo-500 to-blue-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
        }`}>
          <FileText size={18} />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-800 dark:text-white">
            نموذج طلب {titleLabel} (إجازة طويلة)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isDisengagement
              ? 'تثبيت تاريخ الانفكاك للتمتع بالإجازة الطويلة وإعفاء البصمة اعتباراً منه'
              : 'تثبيت تاريخ المباشرة (أو قطع الإجازة وإرجاع الرصيد المتبقي) واستئناف البصمة'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {linkedLeaveInfo && (
          <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200/70 dark:border-blue-800/50 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
            <span>
              إجازة طويلة مرتبطة: <strong>{linkedLeaveInfo.days_count} يوم</strong> ({linkedLeaveInfo.with_pay ? 'براتب تام' : 'بدون راتب'})
            </span>
          </div>
        )}

        {/* حقل تاريخ الانفكاك / المباشرة */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <Calendar size={15} className="text-blue-500" />
            {dateFieldLabel} <span className="text-red-500">*</span>
          </label>
          <DateInput
            value={effectiveDate}
            onChange={setEffectiveDate}
            required
          />
        </div>

        {/* حسب الإجازة المرقمة + بتاريخ */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 space-y-3">
          <div className="text-xs font-bold text-gray-600 dark:text-gray-300">
            حسب الإجازة المرقمة:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <Hash size={13} />
                رقم كتاب الإجازة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={leaveOrderNumber}
                onChange={(e) => setLeaveOrderNumber(e.target.value)}
                placeholder="مثال: 1452"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                بتاريخ (تاريخ إصدار أمر الإجازة) <span className="text-red-500">*</span>
              </label>
              <DateInput
                value={leaveOrderDate}
                onChange={setLeaveOrderDate}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">نوع الإجازة:</span>
            <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
              <input
                type="radio"
                name="withPay"
                checked={withPay}
                onChange={() => setWithPay(true)}
                className="text-blue-600"
              />
              <span>براتب تام</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
              <input
                type="radio"
                name="withPay"
                checked={!withPay}
                onChange={() => setWithPay(false)}
                className="text-blue-600"
              />
              <span>بدون راتب</span>
            </label>
          </div>
        </div>

        {/* تحميل صورة كتاب الإجازة (إلزامي) */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <ImageIcon size={15} className="text-indigo-500" />
            صورة كتاب الإجازة <span className="text-red-500 font-extrabold">(إلزامي *)</span>
          </label>

          {attachmentUrl ? (
            <div className="relative rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 flex items-center justify-between gap-3">
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 min-w-0"
              >
                {attachmentUrl.toLowerCase().endsWith('.pdf') ? (
                  <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 font-bold text-xs">
                    PDF
                  </div>
                ) : (
                  <img
                    src={attachmentUrl}
                    alt="صورة كتاب الإجازة"
                    className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    تم إرفاق صورة كتاب الإجازة بنجاح
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">اضغط للمعاينة</div>
                </div>
              </a>
              <button
                type="button"
                onClick={() => setAttachmentUrl('')}
                className="p-2 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 transition"
                title="إزالة المرفق"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700/60 bg-indigo-50/30 dark:bg-indigo-950/10 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20 cursor-pointer transition">
              {uploading ? (
                <Loader2 size={24} className="animate-spin text-indigo-600" />
              ) : (
                <Upload size={24} className="text-indigo-500" />
              )}
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                {uploading ? 'جارٍ رفع الصورة...' : 'اضغط لرفع صورة كتاب الإجازة (إلزامي)'}
              </span>
              <span className="text-[11px] text-gray-400">JPG, PNG, WEBP, PDF (الحد الأقصى 5MB)</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || uploading}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'جارٍ الإرسال...' : `إرسال طلب ${titleLabel} للمسؤول`}
        </button>
      </form>
    </div>
  );
};

export default MovementRequestForm;
