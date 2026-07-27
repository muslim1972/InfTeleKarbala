import React, { useState, useEffect } from 'react';
import { FileText, AlertCircle, CheckCircle, Clock, Edit2, Search, ChevronDown, ChevronUp, Printer, List, Network, UserCheck } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useEmployeeData } from '../../../hooks/useEmployeeData';
import { supabase } from '../../../lib/supabase';
import { smoothScrollToId } from '../../../hooks/useSmoothScroll';

import { sendPushNotification } from '../../../services/notifications';
import EditLeaveRequestForm from './EditLeaveRequestForm';
import { DateInput } from '../../../components/ui/DateInput';
import LeaveTypeSelector, { type LeaveType } from './LeaveTypeSelector';
import LeaveSupportingImages from './LeaveSupportingImages';
import { LeaveBalanceCard } from './LeaveBalanceCard';
import { LeavePayToggle } from './LeavePayToggle';
import { LeaveTypeInfoAlert } from './LeaveTypeInfoAlert';

interface LeaveRequestFormProps {
  onSuccess?: () => void;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ onSuccess }) => {
  const { user } = useAuth();
  const { data: employeeData, isLoading, invalidateCache } = useEmployeeData(user?.id);
  const financialData = employeeData?.financialData;

  const [formData, setFormData] = useState({
    leaveType: 'regular' as LeaveType,
    startDate: new Date().toISOString().split('T')[0],
    startTime: '', // Must be entered manually by the employee
    daysCount: 1,
    timeDurationMinutes: 30, // For time_off (default 30 mins)
    destination: '', // For dispatch/duty
    withPay: true, // For long leaves
    supportingImageUrls: [] as string[],
    reason: '',
    supervisorId: null as string | null,
    approvalChain: [] as string[],
  });

  const [endDate, setEndDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showBalanceError, setShowBalanceError] = useState(false);
  const [balanceErrorMessage, setBalanceErrorMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [managerInfo, setManagerInfo] = useState<{ id: string, name: string, names?: string[], isTopManagerSelf?: boolean } | null>(null);
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

  useEffect(() => {
    if (isFormExpanded) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          smoothScrollToId('leave-request-form-header', 15);
        });
      });
    }
  }, [isFormExpanded]);

  useEffect(() => {
    if (isArchiveExpanded) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          smoothScrollToId('leave-request-archive-header', 15);
        });
      });
    }
  }, [isArchiveExpanded]);

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

  // Realtime subscription for latest request and balance
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`leave_request_updates_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_requests',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchLatestRequest();
          invalidateCache();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, invalidateCache]);

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
        let chain: string[] = [];
        let names: string[] = [];
        let isTopManagerSelf = false;

        let visitedDepts = new Set<string>();
        while (currentDeptId && !visitedDepts.has(currentDeptId)) {
          visitedDepts.add(currentDeptId);
          const { data: dept } = await supabase.rpc('get_departments_bypass_rls')
            .select(`
              id, name, manager_id, parent_id, level,
              profiles:manager_id(full_name)
            `)
            .eq('id', currentDeptId).single();

          if (!dept) break;

          // If the manager of this department is NOT the user requesting leave
          // AND the manager ID exists, add to our chain!
          if (dept.manager_id && dept.manager_id !== user.id) {
            if (!chain.includes(dept.manager_id)) {
              chain.push(dept.manager_id);
              names.push('مدير ' + dept.name);
            }
          } else if (dept.manager_id === user.id) {
            // User is the manager of this node.
            if (!dept.parent_id) {
                isTopManagerSelf = true;
            }
          }

          // Stop condition:
          // If we reached a department of Level 3 (القسم) or higher (2, 1)
          // AND the user is NOT the manager of this level (if they are, we must escalate to parent)
          if (dept.level <= 3 && dept.manager_id !== user.id) {
            break;
          }

          currentDeptId = dept.parent_id;
        }

        if (chain.length > 0) {
          // Join names for fallback/old usage, but also pass the array for new multi-line UI
          const displayNames = names.join(' ⬅️ ');
          setManagerInfo({ id: chain[0], name: displayNames, names: names, isTopManagerSelf: false });
          setFormData(prev => ({ ...prev, supervisorId: chain[0], approvalChain: chain }));
        } else if (isTopManagerSelf) {
          // We reached the absolute top of the tree AND the user is the top manager!
          setManagerInfo({ id: user.id, name: 'نفسه (مسؤول أعلى)', isTopManagerSelf: true });
          setFormData(prev => ({ ...prev, supervisorId: user.id, approvalChain: [user.id] }));
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
    if (formData.leaveType === 'time_off') {
      if (!formData.startTime) {
        setEndDate('');
        return;
      }
      const [hours, minutes] = formData.startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + formData.timeDurationMinutes;
      const returnHours = Math.floor(totalMinutes / 60) % 24;
      const returnMinutes = totalMinutes % 60;
      const formattedReturnTime = `${returnHours.toString().padStart(2, '0')}:${returnMinutes.toString().padStart(2, '0')}`;
      setEndDate(formattedReturnTime);
      return;
    }

    if (formData.startDate) {
      if (formData.leaveType === 'duty') {
        // Same day return for time-off and duty
        setEndDate(formData.startDate);
        return;
      }
      if (formData.leaveType === 'dispatch') {
        // Dispatch duration is unknown initially, but we can set a placeholder or same day
        setEndDate(formData.startDate);
        return;
      }

      if (formData.daysCount > 0) {
        const start = new Date(formData.startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + formData.daysCount);

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

          if (day === 5 || day === 6) {
            end.setDate(end.getDate() + 1);
            adjusted = true;
          } 
          else if (holidays.some(h => h.m === month && h.d === dayOfMonth)) {
            end.setDate(end.getDate() + 1);
            adjusted = true;
          }
        }
        setEndDate(end.toISOString().split('T')[0]);
      } else {
        setEndDate('');
      }
    } else {
      setEndDate('');
    }
  }, [formData.startDate, formData.daysCount, formData.leaveType, formData.startTime, formData.timeDurationMinutes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.startDate || !formData.reason) {
      setError('يرجى تعبئة جميع الحقول المطلوبة بشكل صحيح.');
      return;
    }
    
    // Validate based on type
    if (['regular', 'long_regular', 'sick', 'long_sick'].includes(formData.leaveType) && formData.daysCount <= 0) {
      setError('يرجى إدخال عدد أيام صحيح.');
      return;
    }
    
    if (formData.startDate < today) {
      setError('لا يمكن أن يكون تاريخ بدء الإجازة في الماضي.');
      return;
    }
    if (formData.leaveType === 'regular' && formData.daysCount > 9) {
      setError('لا يمكن للإجازة الاعتيادية أن تتجاوز 9 أيام. للمدد الأطول، يرجى اختيار إجازة اعتيادية طويلة.');
      return;
    }
    if (formData.leaveType === 'long_regular' && formData.daysCount <= 9) {
      setError('الإجازة الاعتيادية الطويلة يجب أن تكون أكثر من 9 أيام.');
      return;
    }
    if (formData.leaveType === 'sick' && formData.daysCount > 21) {
      setError('الإجازة المرضية يجب أن لا تتجاوز 21 يوماً. للمدد الأطول اختر مرضية طويلة.');
      return;
    }
    if (formData.leaveType === 'long_sick' && formData.daysCount <= 21) {
      setError('الإجازة المرضية الطويلة يجب أن تتجاوز 21 يوماً.');
      return;
    }
    if ((formData.leaveType === 'dispatch' || formData.leaveType === 'duty') && !formData.destination) {
      setError('يرجى إدخال الجهة أو المكان.');
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
      let finalReason = formData.reason;
      let finalStartDate = formData.startDate;
      let finalEndDate = endDate || formData.startDate;

      if (formData.leaveType === 'time_off') {
        finalReason = `(ساعة الخروج: ${formData.startTime}) ${formData.reason ? '- ' + formData.reason : ''}`;
        finalStartDate = new Date().toISOString().split('T')[0]; // force today
        finalEndDate = finalStartDate; // force today for db
      }

      // Use RPC function instead of direct insert
      const { data, error: rpcError } = await supabase.rpc('submit_typed_leave_request', {
        p_leave_type: formData.leaveType,
        p_start_date: finalStartDate,
        p_end_date: finalEndDate,
        p_days_count: (formData.leaveType === 'duty' || formData.leaveType === 'time_off' || formData.leaveType === 'dispatch') ? 1 : formData.daysCount,
        p_reason: finalReason,
        p_supervisor_id: formData.supervisorId, // First supervisor in the chain
        p_approval_chain: (formData as any).approvalChain || [formData.supervisorId], // Pass the whole chain
        p_time_duration_minutes: formData.leaveType === 'time_off' ? formData.timeDurationMinutes : null,
        p_destination: (formData.leaveType === 'dispatch' || formData.leaveType === 'duty') ? formData.destination : null,
        p_with_pay: formData.withPay,
        p_supporting_image_urls: formData.supportingImageUrls
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

      // Notify Supervisor
      if (formData.supervisorId) {
        sendPushNotification(
            formData.supervisorId, 
            `قام الموظف ${user?.full_name} بتقديم طلب إجازة جديد (${formData.startDate})`,
            { title: "طلب إجازة جديد", url: `${window.location.origin}/requests` }
        );
      }

      // Update the cache immediately so user sees the new balance
      await invalidateCache();

      if (onSuccess) onSuccess();

      // Reset form on success
      setFormData(prev => ({ ...prev, startDate: new Date().toISOString().split('T')[0], startTime: '', daysCount: 1, reason: '' }));
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
  const sickLeavesBalance = financialData?.sick_leaves_balance;
  const expiryDate = financialData?.leaves_balance_expiry_date;

  const today = new Date().toISOString().split('T')[0];

  const parseDateObj = (d: string) => {
    if (!d) return new Date(0);
    const dateOnly = d.split(' ')[0].split('T')[0];
    if (dateOnly.includes('-')) {
        const parts = dateOnly.split('-');
        if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (parts[2] && parts[2].length >= 4) return new Date(parseInt(parts[2].substring(0, 4)), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    if (dateOnly.includes('/')) {
        const parts = dateOnly.split('/');
        if (parts[2] && parts[2].length >= 4) return new Date(parseInt(parts[2].substring(0, 4)), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(d);
  };

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const isActiveRequest = (req: any) => {
    if (!req) return false;
    if (req.status === 'rejected') return false;
    if (req.cancellation_status === 'approved') return false;
    
    if (req.cut_date && req.hr_cut_status === 'approved') {
        // cut_date = يوم المباشرة (العودة للعمل) → الإجازة فعلياً انتهت قبله
        return parseDateObj(req.cut_date).getTime() > todayDate.getTime();
    }
    
    // end_date = آخر يوم إجازة (شامل) → الإجازة فعالة في هذا اليوم
    return parseDateObj(req.end_date).getTime() >= todayDate.getTime();
  };

  const showLatestRequest = latestRequest && isActiveRequest(latestRequest);
  const canModifyLatest = showLatestRequest && latestRequest.status !== 'rejected' && latestRequest.modification_type !== 'canceled' && parseDateObj(latestRequest.end_date).getTime() >= todayDate.getTime();

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
      {showLatestRequest && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between backdrop-blur-sm transition-all duration-300 ${canModifyLatest ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200/60 dark:from-indigo-900/20 dark:to-purple-900/20 dark:border-indigo-800/50' : 'bg-gray-50/80 border-gray-200/60 dark:bg-slate-800/50 dark:border-slate-700/50'}`}>
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-2">
              <Clock size={14} className="text-indigo-500" />
              أحدث طلب إجازة ({latestRequest.leave_type === 'regular' ? 'اعتيادية' : latestRequest.leave_type === 'sick' ? 'مرضية' : latestRequest.leave_type === 'time_off' ? 'زمنية' : latestRequest.leave_type === 'dispatch' ? 'إيفاد' : latestRequest.leave_type === 'duty' ? 'واجب' : latestRequest.leave_type === 'long_regular' ? 'اعتيادية طويلة' : latestRequest.leave_type === 'long_sick' ? 'مرضية طويلة' : 'إجازة'})
              {latestRequest.modification_type === 'canceled' && (
                <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${latestRequest.status === 'canceled' ? 'text-red-500 bg-red-50 dark:bg-red-900/30' : 'text-amber-500 bg-amber-50 dark:bg-amber-900/30'}`}>
                  {latestRequest.status === 'canceled' ? 'ملغاة نهائياً' : 'بانتظار الموافقة على الإلغاء'}
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              من {latestRequest.start_date} إلى {latestRequest.end_date}
              <span className={`mx-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                latestRequest.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                latestRequest.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                latestRequest.status === 'canceled' ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300' :
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {latestRequest.status === 'pending' ? 'قيد الانتظار' :
                 latestRequest.status === 'approved' ? 'موافق عليه' :
                 latestRequest.status === 'canceled' ? 'ملغاة' :
                 'مرفوض'}
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

      {/* Smart Balance Card */}
      <LeaveBalanceCard
        leaveType={formData.leaveType}
        regularBalance={leavesBalance}
        sickBalance={sickLeavesBalance}
        expiryDate={expiryDate}
        isLoading={isLoading}
      />

      {/* Form Section - Collapsible */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <button
          id="leave-request-form-header"
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
            
            <LeaveTypeSelector 
              selectedType={formData.leaveType} 
              onSelect={(type) => {
                setFormData({ ...formData, leaveType: type, daysCount: 1, supportingImageUrls: [] });
                setError(null);
              }} 
            />

            <LeaveTypeInfoAlert leaveType={formData.leaveType} />

            {/* Automatic Routing Info */}
            <div className={`p-4 rounded-xl border flex items-center justify-between \${managerInfo ? 'bg-blue-50 dark:bg-slate-900/50 border-blue-100 dark:border-blue-900/50' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30'}`}>
              <div className="flex-1">
                <span className={`block text-sm font-bold mb-1 ${managerInfo ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                  توجيه الطلب تلقائياً إلى:
                </span>
                {loadingManager ? (
                  <span className="text-gray-500 flex items-center gap-2 text-sm"><Clock className="w-4 h-4 animate-spin" /> جاري تحديد المسؤول من الهيكلية...</span>
                ) : managerInfo ? (
                  <div className="space-y-3 mt-2">
                    {managerInfo.names ? (
                      managerInfo.names.map((n, i) => (
                        <div key={i} className="text-gray-900 dark:text-gray-100 font-medium flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-blue-500" />
                          <span>المستوى {i + 1}: {n}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-900 dark:text-gray-100 font-medium flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-blue-500" />
                        <span>{managerInfo.name}</span>
                      </div>
                    )}
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
              {/* Start Date / Time */}
              <div>
                {formData.leaveType === 'time_off' ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ساعة البداية (الخروج)
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition dir-ltr text-left"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      تاريخ {formData.leaveType === 'dispatch' ? 'الإيفاد' : formData.leaveType === 'duty' ? 'الواجب' : 'البداية'}
                    </label>
                    <DateInput
                      value={formData.startDate}
                      onChange={(dateStr) => setFormData({ ...formData, startDate: dateStr })}
                      min={today}
                      required
                    />
                  </>
                )}
              </div>

              {/* Days Count */}
              {!['duty', 'time_off', 'dispatch'].includes(formData.leaveType) && (
                <div className="space-y-4">
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
                        setError(null);
                        setFormData({ ...formData, daysCount: val });
                      }}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>

                  <LeavePayToggle
                    leaveType={formData.leaveType}
                    withPay={formData.withPay}
                    onToggle={(withPay) => setFormData({ ...formData, withPay })}
                    balance={['sick', 'long_sick'].includes(formData.leaveType) ? sickLeavesBalance : leavesBalance}
                    daysCount={formData.daysCount}
                  />
                </div>
              )}

              {/* Destination */}
              {['dispatch', 'duty'].includes(formData.leaveType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الجهة أو المكان
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="مثال: وزارة التعليم، محافظة بغداد..."
                  />
                </div>
              )}

              {/* Time Duration */}
              {formData.leaveType === 'time_off' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    المدة الزمنية
                  </label>
                  <select
                    value={formData.timeDurationMinutes}
                    onChange={(e) => setFormData({ ...formData, timeDurationMinutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-[position:left_1rem_center] pr-4 pl-10"
                  >
                    <option value={30}>نصف ساعة</option>
                    <option value={60}>ساعة واحدة</option>
                    <option value={90}>ساعة ونصف</option>
                    <option value={120}>ساعتان</option>
                  </select>
                </div>
              )}
            </div>

            {/* End Date / Time Display */}
            <div className="bg-blue-50 dark:bg-slate-700/50 p-4 rounded-xl flex justify-between items-center border border-blue-100 dark:border-slate-600">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {formData.leaveType === 'time_off' ? 'ساعة العودة المتوقعة:' : 'تاريخ المباشرة المتوقع:'}
              </span>
              <span className="font-bold text-lg text-blue-700 dark:text-blue-300 dir-ltr">
                {endDate || '-'}
              </span>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                السبب / التفاصيل
              </label>
              <textarea
                required
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
                placeholder="أذكر سبب الطلب أو التفاصيل..."
              />
            </div>

            {/* Images Uploader (Optional) */}
            {formData.leaveType !== 'time_off' && (
              <LeaveSupportingImages 
                maxImages={3}
                onImagesChange={(urls) => setFormData({ ...formData, supportingImageUrls: urls })} 
              />
            )}

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
              id="leave-request-archive-header"
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
