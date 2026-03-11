import React, { useState, useEffect } from 'react';
import { FileText, AlertCircle, CheckCircle, Clock, Edit2, Search, ChevronDown, ChevronUp, Printer, List, Network, UserCheck } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useEmployeeData } from '../../../hooks/useEmployeeData';
import { supabase } from '../../../lib/supabase';
import EditLeaveRequestForm from './EditLeaveRequestForm';
import { DateInput } from '../../../components/ui/DateInput';

interface LeaveRequestFormProps {
  onSuccess?: () => void;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ onSuccess }) => {
  const { user } = useAuth();
  const { data: employeeData, isLoading, invalidateCache } = useEmployeeData(user?.id);
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

  const [managerInfo, setManagerInfo] = useState<{ id: string, name: string, isTopManagerSelf?: boolean } | null>(null);
  const [loadingManager, setLoadingManager] = useState(true);

  // Latest request logic
  const [latestRequest, setLatestRequest] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Personal Archive State
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);
  const [archiveStartDate, setArchiveStartDate] = useState('');
  const [archiveEndDate, setArchiveEndDate] = useState('');
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [archiveRecords, setArchiveRecords] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);

  const handleArchiveSearch = async () => {
    if (!user) return;
    setIsLoadingArchive(true);
    setHasSearched(true);

    try {
      let query = supabase
        .from('leave_requests')
        .select(`
          id, start_date, end_date, days_count, status, cancellation_status, created_at, unpaid_days,
          leave_history(new_balance, action_type)
        `)
        .eq('user_id', user.id)
        .eq('status', 'approved'); // Only show approved ones for printing

      if (archiveStartDate) query = query.gte('start_date', archiveStartDate);
      if (archiveEndDate) query = query.lte('end_date', archiveEndDate);
      query = query.order('start_date', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setArchiveRecords(data || []);
    } catch (err) {
      console.error("Error fetching personal archive", err);
    } finally {
      setIsLoadingArchive(false);
    }
  };

  const handlePrintList = async () => {
    try {
      setIsLoadingArchive(true);
      const { generateArchiveListPDF } = await import('../../../utils/pdfListGenerator');
      const pdfBlobUrl = await generateArchiveListPDF(
          user?.full_name || 'غير معروف',
          archiveStartDate,
          archiveEndDate
      );
      
      // Use a temporary download link instead of window.open to avoid popup blocker
      const link = document.createElement('a');
      link.href = pdfBlobUrl as unknown as string;
      link.download = `قائمة_اجازات_${user?.full_name || 'موظف'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      console.error('PDF generation error:', e);
      alert(`حدث خطأ أثناء إنشاء ملف PDF: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsLoadingArchive(false);
    }
  };

  const fetchLatestRequest = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setLatestRequest(data);
      }
    } catch (err) {
      console.error('Error fetching latest request:', err);
    }
  };

  useEffect(() => {
    fetchLatestRequest();
  }, [user, success]); // refetch on success

  // Auto-calculate Supervisor based on hierarchy
  useEffect(() => {
    const fetchManager = async () => {
      if (!user) return;
      try {
        setLoadingManager(true);
        // 1. Fetch user profile's department_id
        const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', user.id).single();
        if (!profile?.department_id) {
          setLoadingManager(false);
          return;
        }

        // 2. Start checking from the user's immediate department
        let currentDeptId = profile.department_id;
        let finalSupervisorId: string | null = null;
        let finalSupervisorName: string | undefined = undefined;
        let isTopManagerSelf = false;

        while (currentDeptId) {
          const { data: dept } = await supabase.from('departments')
            .select(`
              id, manager_id, parent_id, 
              profiles:manager_id(full_name)
            `)
            .eq('id', currentDeptId).single();

          if (!dept) break;

          // If the manager of this department is NOT the user requesting leave
          // AND the manager ID exists, we found our target!
          if (dept.manager_id && dept.manager_id !== user.id) {
            finalSupervisorId = dept.manager_id;
            finalSupervisorName = (dept.profiles as any)?.full_name;
            break;
          }

          // If the user IS the manager of this department, we need to escalate to the parent
          if (dept.manager_id === user.id) {
            if (dept.parent_id) {
              // Move up the tree
              currentDeptId = dept.parent_id;
            } else {
              // We reached the absolute top of the tree AND the user is the top manager!
              // Fallback to themselves, but flag it so we can show a special message.
              finalSupervisorId = dept.manager_id;
              finalSupervisorName = (dept.profiles as any)?.full_name;
              isTopManagerSelf = true;
              break;
            }
          } else if (!dept.manager_id) {
            // Department has no manager assigned, try escalating to parent if exists
            if (dept.parent_id) {
              currentDeptId = dept.parent_id;
            } else {
              break; // Reached the top with no manager
            }
          }
        }

        if (finalSupervisorId && finalSupervisorName) {
          setManagerInfo({ id: finalSupervisorId, name: finalSupervisorName, isTopManagerSelf });
          setFormData(prev => ({ ...prev, supervisorId: finalSupervisorId }));
        }

      } catch (err) {
        console.error("Error fetching manager for routing:", err);
      } finally {
        setLoadingManager(false);
      }
    };

    fetchManager();
  }, [user]);

  // Calculate expected return date automatically (with auto-adjustment)
  useEffect(() => {
    if (formData.startDate && formData.daysCount > 0) {
      const start = new Date(formData.startDate);
      const end = new Date(start);
      // Expected return date is Start Date + Days Count
      end.setDate(start.getDate() + formData.daysCount);

      // Auto-adjust: skip Fridays and holidays (Saturday remains as-is for rejection)
      const holidays = [
        { m: 1, d: 1 }, { m: 1, d: 6 },
        { m: 3, d: 16 }, { m: 3, d: 21 },
        { m: 5, d: 1 }
      ];

      let adjusted = true;
      while (adjusted) {
        adjusted = false;
        const day = end.getDay(); // 0=Sun .. 5=Fri 6=Sat
        const month = end.getMonth() + 1;
        const dayOfMonth = end.getDate();

        if (day === 5) {
          // Friday → skip to Sunday
          end.setDate(end.getDate() + 2);
          adjusted = true;
        } else if (holidays.some(h => h.m === month && h.d === dayOfMonth)) {
          // Holiday → advance one day
          end.setDate(end.getDate() + 1);
          adjusted = true;
        }
      }

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
    if (formData.startDate < today) {
      setError('لا يمكن أن يكون تاريخ بدء الإجازة في الماضي.');
      return;
    }
    if (formData.daysCount > 10) {
      setError('لا يمكن للإجازة الاعتيادية أن تتجاوز 10 أيام. للمدد الأطول، يرجى تقديم استمارة طلب إجازة طويلة.');
      return;
    }

    // Prohibited days validation (Weekends and Holidays)
    const isProhibitedDay = (dateStr: string) => {
      const date = new Date(dateStr);
      const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
      const month = date.getMonth() + 1; // 1-indexed
      const dayOfMonth = date.getDate();

      // Weekends: Friday (5) and Saturday (6)
      if (day === 5 || day === 6) return { prohibited: true, reason: 'يصادف يوم جمعة أو سبت' };

      // Iraqi Holidays
      const holidays = [
        { m: 1, d: 1, name: 'رأس السنة الميلادية' },
        { m: 1, d: 6, name: 'عيد الجيش العراقي' },
        { m: 3, d: 16, name: 'ذكرى قصف حلبجة' },
        { m: 3, d: 21, name: 'عيد نوروز' },
        { m: 5, d: 1, name: 'عيد العمال العالمي' }
      ];

      const holiday = holidays.find(h => h.m === month && h.d === dayOfMonth);
      if (holiday) return { prohibited: true, reason: holiday.name };

      return { prohibited: false };
    };

    const startCheck = isProhibitedDay(formData.startDate);
    if (startCheck.prohibited) {
      setError(`لا يجوز أن يصادف يوم البداية ${startCheck.reason}.`);
      return;
    }

    // Only reject Saturday for return date (Friday/holidays are auto-adjusted)
    const endDay = new Date(endDate).getDay();
    if (endDay === 6) {
      setError('لا يجوز أن يصادف يوم المباشرة المتوقعة يوم سبت. يرجى تعديل عدد الأيام.');
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

      // Update the cache immediately so user sees the new balance
      await invalidateCache();

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

  const today = new Date().toISOString().split('T')[0];
  const canModifyLatest = latestRequest && latestRequest.status !== 'rejected' && latestRequest.modification_type !== 'canceled' && latestRequest.end_date >= today;

  if (isEditing && latestRequest) {
    return (
      <EditLeaveRequestForm
        request={latestRequest}
        onCancelEdit={() => setIsEditing(false)}
        onSuccess={async () => {
          setIsEditing(false);
          await invalidateCache(); // Refresh balance after cancel/edit
          fetchLatestRequest();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Latest Request banner */}
      {latestRequest && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between backdrop-blur-sm transition-all duration-300 ${canModifyLatest ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200/60 dark:from-indigo-900/20 dark:to-purple-900/20 dark:border-indigo-800/50' : 'bg-gray-50/80 border-gray-200/60 dark:bg-slate-800/50 dark:border-slate-700/50'}`}>
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-2">
              <Clock size={14} className="text-indigo-500" />
              أحدث طلب إجازة
              {latestRequest.modification_type === 'canceled' && <span className="text-red-500 font-bold text-xs bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">ملغي</span>}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              من {latestRequest.start_date} إلى {latestRequest.end_date}
              <span className={`mx-2 px-2 py-0.5 rounded-full text-xs font-bold ${latestRequest.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : latestRequest.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                {latestRequest.status === 'pending' ? 'قيد الانتظار' : latestRequest.status === 'approved' ? 'موافق عليه' : 'مرفوض'}
              </span>
            </p>
          </div>
          {canModifyLatest && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              <Edit2 size={14} />
              تعديل
            </button>
          )}
        </div>
      )}

      {/* Compact Balance Card */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 text-white rounded-2xl shadow-lg shadow-indigo-500/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <CalendarCheck size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold opacity-90">رصيد الإجازات</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold">
                  {isLoading ? '...' : (leavesBalance !== undefined ? leavesBalance : '-')}
                </span>
                <span className="text-xs font-normal opacity-75">يوم</span>
              </div>
            </div>
          </div>
          {expiryDate && (
            <div className="text-xs opacity-70 flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-lg">
              <Clock size={11} />
              لغاية: {expiryDate}
            </div>
          )}
        </div>
      </div>

      {/* Form Section - Collapsible */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsFormExpanded(!isFormExpanded)}
          className="w-full flex items-center justify-between p-5 focus:outline-none hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <FileText size={18} />
            </div>
            <div className="text-right">
              <h2 className="text-base font-bold text-gray-800 dark:text-white">نموذج طلب إجازة</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">تقديم طلب إجازة جديد</p>
            </div>
          </div>
          <div className={`p-2 rounded-full transition-all duration-300 ${isFormExpanded ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
            {isFormExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {isFormExpanded && (
          <div className="px-5 pb-6 animate-in slide-in-from-top-2 duration-200">
            <div className="border-t border-gray-100 dark:border-slate-700 pt-5">

        {success ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-2">تم الإرسال بنجاح</h3>
            <p className="text-green-600 dark:text-green-400 mb-6 text-sm">
              تم إرسال الطلب إلى المسؤول المباشر للموافقة. ستصلك الإجابة قريباً.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-500/20"
            >
              تقديم طلب جديد
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Automatic Routing Info */}
            <div className={`p-4 rounded-xl border flex items-center justify-between \${managerInfo ? 'bg-blue-50 dark:bg-slate-900/50 border-blue-100 dark:border-blue-900/50' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30'}`}>
              <div className="flex-1">
                <span className={`block text-sm font-bold mb-1 ${managerInfo ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                  توجيه الطلب تلقائياً إلى:
                </span>
                {loadingManager ? (
                  <span className="text-gray-500 flex items-center gap-2 text-sm"><Clock className="w-4 h-4 animate-spin" /> جاري تحديد المسؤول من الهيكلية...</span>
                ) : managerInfo ? (
                  <div className="space-y-2">
                    <span className="text-gray-900 dark:text-gray-100 font-medium flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-blue-500" />
                      {managerInfo.name}
                    </span>
                    {managerInfo.isTopManagerSelf && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300 rounded-lg text-xs leading-relaxed font-semibold">
                        حيث أنه لا توجد في التطبيق جهة عليا لحد الان فتم اعادة عرض الطلب عليك . يرجى ابداء الرأي . مع التقدير
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-red-500 font-medium text-sm">
                    ⚠️ لم يتم تحديد قسم أو مسؤول مباشر لك في الهيكلية الإدارية، راجع الإدارة.
                  </span>
                )}
              </div>
              <Network className={`w-10 h-10 \${managerInfo ? 'text-blue-200 dark:text-blue-800' : 'text-red-200 dark:text-red-800/50'}`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  تاريخ البداية
                </label>
                <DateInput
                  value={formData.startDate}
                  onChange={(dateStr) => setFormData({ ...formData, startDate: dateStr })}
                  min={today}
                  required
                />
              </div>

              {/* Days Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  عدد الأيام
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.daysCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    if (val > 10) {
                      setError('لا يمكن للإجازة الاعتيادية أن تتجاوز 10 أيام.');
                      return;
                    }
                    setError(null);
                    setFormData({ ...formData, daysCount: val });
                  }}
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
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'جاري الإرسال...' : 'إرسال الطلب للمسؤول'}
            </button>
          </form>
        )}

            </div>
          </div>
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
              {leavesBalance !== undefined && formData.daysCount > leavesBalance && (
                <span className="block mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800/50 dark:text-amber-300 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>⚠️ الرصيد غير كافي.</strong> سيتم احتساب ({formData.daysCount - leavesBalance}) أيام منها كإجازة بدون راتب.
                    <br />
                    اضغط <strong>نعم، أرسل</strong> في حالة الموافقة أو <strong>تراجع</strong> للإلغاء.
                  </span>
                </span>
              )}
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

      {/* Personal Archive Section (Collapsible) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <button
              onClick={() => setIsArchiveExpanded(!isArchiveExpanded)}
              className="w-full flex items-center justify-between p-5 focus:outline-none hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors print:hidden"
          >
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                      <List size={18} />
                  </div>
                  <div className="text-right">
                      <h2 className="text-base font-bold text-gray-800 dark:text-white">قائمة إجازاتك</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">ابحث عن إجازاتك السابقة واطبعها كقائمة</p>
                  </div>
              </div>
              <div className={`p-2 rounded-full transition-all duration-300 ${isArchiveExpanded ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                  {isArchiveExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
          </button>

          {(isArchiveExpanded || (typeof window !== 'undefined' && window.matchMedia('print').matches)) && (
              <div className="mt-6 animate-in slide-in-from-top-4 duration-300">
                  {/* Date Filters + Search Button */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 print:hidden">
                      <div>
                          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">من تاريخ</label>
                          <input
                              type="date"
                              value={archiveStartDate}
                              onChange={e => setArchiveStartDate(e.target.value)}
                              className="w-full text-sm border-gray-200 dark:border-slate-600 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 outline-none transition"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">إلى تاريخ</label>
                          <input
                              type="date"
                              value={archiveEndDate}
                              onChange={e => setArchiveEndDate(e.target.value)}
                              className="w-full text-sm border-gray-200 dark:border-slate-600 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 outline-none transition"
                          />
                      </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 mb-8 print:hidden">
                      <button
                          type="button"
                          onClick={handleArchiveSearch}
                          disabled={isLoadingArchive}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex justify-center items-center gap-2"
                      >
                          {isLoadingArchive ? <AlertCircle size={18} className="animate-spin" /> : <Search size={18} />}
                          بحث
                      </button>
                      <button
                          type="button"
                          onClick={handlePrintList}
                          disabled={archiveRecords.length === 0}
                          className="flex-1 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white py-2.5 rounded-xl font-bold transition shadow-md disabled:opacity-50 flex justify-center items-center gap-2"
                      >
                          <Printer size={18} /> طباعة القائمة
                      </button>
                  </div>

                  {/* Archive Table Preview */}
                  <div className="archive-preview-section mt-4">
                      {hasSearched && archiveRecords.length === 0 && !isLoadingArchive ? (
                          <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                              لا توجد إجازات بهذه المعايير
                          </div>
                      ) : null}

                      {archiveRecords.length > 0 && (
                          <div className="overflow-x-hidden w-full">
                              <table id="archive-table" className="w-full text-sm text-right text-black border-2 border-black" style={{ tableLayout: 'fixed' }}>
                                  <thead className="text-sm text-black font-bold uppercase bg-gray-100 border-b-2 border-black">
                                      <tr>
                                          <th scope="col" className="px-2 py-3 border-l-2 border-black text-center" style={{ width: '18%' }}>تاريخ البداية</th>
                                          <th scope="col" className="px-2 py-3 border-l-2 border-black text-center" style={{ width: '18%' }}>تاريخ النهاية</th>
                                          <th scope="col" className="px-2 py-3 border-l-2 border-black text-center" style={{ width: '13%' }}>عدد الأيام</th>
                                          <th scope="col" className="px-2 py-3 border-l-2 border-black text-center" style={{ width: '13%' }}>بدون راتب</th>
                                          <th scope="col" className="px-2 py-3 border-l-2 border-black text-center" style={{ width: '15%' }}>الحالة</th>
                                          <th scope="col" className="px-2 py-3 text-center" style={{ width: '23%' }}>الرصيد المتبقي (وقتها)</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {archiveRecords.map((record) => {
                                          const isCancelled = record.cancellation_status === 'approved';
                                          // Find the balance at the exact time of approval
                                          const approvalHistory = record.leave_history?.find((h: any) => h.action_type === 'leave_approved');
                                          const historicBalance = approvalHistory?.new_balance ?? '-';

                                          return (
                                              <tr key={record.id} className="bg-white border-b-2 border-black hover:bg-gray-50">
                                                  <td className="px-2 py-4 font-mono dir-ltr text-center font-bold border-l-2 border-black text-black">{record.start_date}</td>
                                                  <td className="px-2 py-4 font-mono dir-ltr text-center font-bold border-l-2 border-black text-black">{record.end_date}</td>
                                                  <td className="px-2 py-4 font-bold border-l-2 border-black text-center text-black text-lg">{record.days_count}</td>
                                                  <td className="px-2 py-4 border-l-2 border-black text-center text-black font-bold">
                                                      {record.unpaid_days > 0 ? <span className="text-black font-bold">{record.unpaid_days}</span> : '0'}
                                                  </td>
                                                  <td className="px-2 py-4 border-l-2 border-black text-center">
                                                      {isCancelled ? (
                                                          <span className="text-black font-bold">ملغاة</span>
                                                      ) : (
                                                          <span className="text-black font-bold">معتمد</span>
                                                      )}
                                                  </td>
                                                  <td className="px-2 py-4 text-center font-bold text-black text-lg">
                                                      {historicBalance}
                                                  </td>
                                              </tr>
                                          );
                                      })}
                                  </tbody>
                              </table>
                          </div>
                      )}
                  </div>
              </div>
          )}
      </div>
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
