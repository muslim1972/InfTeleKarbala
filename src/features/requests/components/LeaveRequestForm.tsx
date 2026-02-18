import React, { useState, useEffect } from 'react';
import { Calendar, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useEmployeeData } from '../../../hooks/useEmployeeData';
import { supabase } from '../../../lib/supabase';
import { SupervisorSelector } from './SupervisorSelector';

interface LeaveRequestFormProps {
  onSuccess?: () => void;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ onSuccess }) => {
  const { user } = useAuth();
  const { data: employeeData, isLoading } = useEmployeeData(user?.id);
  const financialData = employeeData?.financialData;

  const [formData, setFormData] = useState({
    startDate: '',
    daysCount: 1,
    reason: '',
    supervisorId: null as string | null,
  });

  const [endDate, setEndDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showBalanceError, setShowBalanceError] = useState(false);
  const [balanceErrorMessage, setBalanceErrorMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calculate end date automatically
  useEffect(() => {
    if (formData.startDate && formData.daysCount > 0) {
      const start = new Date(formData.startDate);
      const end = new Date(start);
      // Subtract 1 day because the start day counts as the first day
      end.setDate(start.getDate() + formData.daysCount - 1);
      setEndDate(end.toISOString().split('T')[0]);
    } else {
      setEndDate('');
    }
  }, [formData.startDate, formData.daysCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.startDate || formData.daysCount <= 0 || !formData.reason) {
      setError('يرجى تعبئة جميع الحقول المطلوبة بشكل صحيح.');
      return;
    }
    if (!formData.supervisorId) {
      setError('يرجى اختيار المسؤول المباشر لإرسال الطلب إليه.');
      return;
    }
    setError(null);
    setShowConfirmModal(true);
  };

  const confirmSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Use RPC function instead of direct insert
      const { data, error: rpcError } = await supabase.rpc('submit_leave_request', {
        p_start_date: formData.startDate,
        p_end_date: endDate,
        p_days_count: formData.daysCount,
        p_reason: formData.reason,
        p_supervisor_id: formData.supervisorId // Pass supervisor ID
      });

      if (rpcError) throw rpcError;

      // Custom check for logic error from the function (it returns JSON)
      const response = data as any;

      if (!response || !response.success) {
        setBalanceErrorMessage(response?.message || 'تعذر تقديم الطلب، يرجى المحاولة لاحقاً.');
        setShowBalanceError(true);
        setShowConfirmModal(false);
        return;
      }

      setSuccess(true);
      setShowConfirmModal(false);
      if (onSuccess) onSuccess();

      // Reset form on success
      setFormData({ startDate: '', daysCount: 1, reason: '', supervisorId: null });
      setEndDate('');

    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'حدث خطأ أثناء إرسال الطلب');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const leavesBalance = financialData?.remaining_leaves_balance;
  const expiryDate = financialData?.leaves_balance_expiry_date;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 pb-8">
      {/* Balance Info Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white rounded-t-2xl">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold opacity-90 mb-1">رصيد الإجازات المتبقي</h3>
            <div className="text-3xl font-extrabold flex items-baseline gap-2">
              {isLoading ? (
                <span className="animate-pulse opacity-70">...</span>
              ) : (
                <span>{leavesBalance !== undefined ? leavesBalance : '-'}</span>
              )}
              <span className="text-sm font-normal opacity-75">يوم</span>
            </div>
            {expiryDate && (
              <p className="text-xs mt-2 opacity-80 flex items-center gap-1">
                <Clock size={12} />
                محسوب لغاية: {expiryDate}
              </p>
            )}
          </div>
          <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
            <CalendarCheck size={24} className="text-white" />
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
          <FileText className="text-blue-600" size={24} />
          نموذج طلب إجازة
        </h2>

        {success ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center animate-fade-in-up">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-2">تم الإرسال بنجاح</h3>
            <p className="text-green-600 dark:text-green-400 mb-6">
              تم إرسال الطلب إلى المسؤول المباشر للموافقة. ستصلك الإجابة قريباً.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition shadow-lg shadow-green-500/20"
            >
              تقديم طلب جديد
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Supervisor Selector */}
            <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700 mb-4">
              <SupervisorSelector
                selectedSupervisorId={formData.supervisorId}
                onSelect={(id) => setFormData({ ...formData, supervisorId: id })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  تاريخ البداية
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                  <Calendar className="absolute left-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>

              {/* Days Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  عدد الأيام
                </label>
                <input
                  type="number"
                  min="1"
                  max={leavesBalance || 30}
                  required
                  value={formData.daysCount}
                  onChange={(e) => setFormData({ ...formData, daysCount: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            {/* End Date Display */}
            <div className="bg-blue-50 dark:bg-slate-700/50 p-4 rounded-xl flex justify-between items-center border border-blue-100 dark:border-slate-600">
              <span className="text-sm text-gray-600 dark:text-gray-300">تاريخ النهاية المتوقع:</span>
              <span className="font-bold text-lg text-blue-700 dark:text-blue-300 dir-ltr">
                {endDate || '-'}
              </span>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                سبب الإجازة
              </label>
              <textarea
                required
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
                placeholder="أذكر سبب طلب الإجازة..."
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'جاري الإرسال...' : 'إرسال الطلب للمسؤول'}
            </button>
          </form>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl scale-100">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">تأكيد إرسال الطلب</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              هل أنت متأكد من صحة المعلومات المدخلة؟
              <br />
              <span className="font-semibold block mt-2 text-blue-600 dark:text-blue-400">
                البداية: {formData.startDate} | المدة: {formData.daysCount} يوم
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                تراجع
              </button>
              <button
                onClick={confirmSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"
              >
                {isSubmitting ? 'جاري التأكيد...' : 'نعم، أرسل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Error Modal */}
      {showBalanceError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border-2 border-red-500/20">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">عذراً، لا يمكن إتمام الطلب</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-center leading-relaxed">
              {balanceErrorMessage}
            </p>
            <button
              onClick={() => setShowBalanceError(false)}
              className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white font-bold rounded-xl transition"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

// Helper icon component
function CalendarCheck({ size = 24, className = "" }: { size?: number, className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

export default LeaveRequestForm;
