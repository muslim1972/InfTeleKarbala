import { useState, useEffect, useCallback } from 'react';
import { Bell, X, CheckCircle, Clock, Printer, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useGovernorate } from '../../context/GovernorateContext';
import { ApprovalModal } from '../../features/requests/components/ApprovalModal';
import { NotificationHistoryModal } from '../notifications/NotificationHistoryModal';
import { printContinuityLetterDirect } from '../../features/hr/utils/printContinuityDirect';
import { approveLeaveConflict } from '../../features/attendance/services/attendanceRequestEngine';
import { toast } from 'react-hot-toast';

const getLeaveTypeName = (type?: string, subtype?: string, isMandatory?: boolean) => {
    switch (type) {
        case 'regular': return 'إجازة اعتيادية';
        case 'sick': return 'إجازة مرضية';
        case 'time_off': {
            let label = 'إجازة زمنية';
            if (subtype === 'shift_start') label += ' (بداية الدوام)';
            else if (subtype === 'shift_end') label += ' (نهاية الدوام)';
            else if (subtype === 'mid_shift') label += ' (وسط الدوام)';
            
            if (isMandatory) label += ' - بدون طلب';
            else label += ' - بطلب';
            
            return label;
        }
        case 'duty': return 'واجب رسمي';
        case 'dispatch': return 'إيفاد';
        case 'long_regular': return 'إجازة اعتيادية طويلة';
        case 'long_sick': return 'إجازة مرضية طويلة';
        default: return 'إجازة';
    }
};

export const AppNotifications = () => {
    const { user } = useAuth();
    const { activeGovernorate } = useGovernorate();
    const [showModal, setShowModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    // Badge Counts
    const [employeeUnreadCount, setEmployeeUnreadCount] = useState(0);
    const [supervisorPendingCount, setSupervisorPendingCount] = useState(0);
    const [systemNotificationsCount, setSystemNotificationsCount] = useState(0);

    // Data lists
    const [employeeRequests, setEmployeeRequests] = useState<any[]>([]);
    const [supervisorRequests, setSupervisorRequests] = useState<any[]>([]);
    const [hrRequests, setHrRequests] = useState<any[]>([]);
    const [systemNotifications, setSystemNotifications] = useState<any[]>([]);
    const [dismissedHRRequestIds, setDismissedHRRequestIds] = useState<Set<string>>(new Set());
    const [dismissedEmployeeRequestIds, setDismissedEmployeeRequestIds] = useState<Set<string>>(new Set());

    // Modal state
    const [selectedApprovalRequest, setSelectedApprovalRequest] = useState<any>(null);
    // أزرار الإجراءات الذكية (بصمة متعارضة/طلب معلق): منع النقر المزدوج
    const [smartActionLoading, setSmartActionLoading] = useState<string | null>(null);
    // طلب معلق يُفتح من إشعار «بصمة مع طلب قيد المراجعة» في نموذج الاعتماد المعتمد
    const [smartApprovalRequest, setSmartApprovalRequest] = useState<any>(null);

    // حالات التفاعل مع طلبات الاستمرارية المالية
    const [rejectingFinanceNotifId, setRejectingFinanceNotifId] = useState<string | null>(null);
    const [financeRejectionReason, setFinanceRejectionReason] = useState("");
    const [editingFinanceNotifId, setEditingFinanceNotifId] = useState<string | null>(null);
    const [financeEditDestination, setFinanceEditDestination] = useState("");
    const [financeEditNotes, setFinanceEditNotes] = useState("");
    const [financeCadreMap, setFinanceCadreMap] = useState<Record<string, 'permanent' | 'contract'>>({});
    const [financeCcMap, setFinanceCcMap] = useState<Record<string, string[]>>({});
    const [financeCcInputMap, setFinanceCcInputMap] = useState<Record<string, string>>({});


    // Using useCallback to prevent unnecessary re-renders in useEffect dependencies
    const fetchEmployeeNotifications = useCallback(async () => {
        if (!user || user.id === 'visitor-id') return;
        const { data, count, error } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact' })
            .eq('user_id', user.id)
            .or('status.in.(approved,rejected,canceled),cancellation_status.in.(approved,rejected),cut_status.in.(approved,rejected)')
            .eq('is_read_by_employee', false);

        if (error) {
            console.error('AppNotifications: Error fetching employee requests:', error);
        } else if (data && data.length > 0) {
            const validIds = data.map(r => r.supervisor_id).filter(Boolean);
            const supervisorIds = [...new Set(validIds)];
            const supervisorMap: Record<string, string> = {};

            if (supervisorIds.length > 0) {
                const { data: supervisorsData } = await supabase
                    .rpc('get_basic_profiles', { p_user_ids: supervisorIds });
                if (supervisorsData) supervisorsData.forEach((sup: any) => { supervisorMap[sup.id] = sup.full_name; });
            }

            const formattedData = data.map(item => ({
                ...item,
                supervisor: item.supervisor_id && supervisorMap[item.supervisor_id]
                    ? { full_name: supervisorMap[item.supervisor_id] }
                    : null
            }));
            setEmployeeRequests(formattedData);
            setEmployeeUnreadCount(count || 0);
        } else {
            setEmployeeRequests([]);
            setEmployeeUnreadCount(0);
        }
    }, [user]);

    const fetchSupervisorNotifications = useCallback(async () => {
        if (!user || user.id === 'visitor-id') return;
        const { data, error } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact' })
            .eq('supervisor_id', user.id)
            .or('status.eq.pending,leave_status.eq.pending,cancellation_status.eq.pending,cut_status.eq.pending');

        if (error) {
            console.error('AppNotifications: Error fetching supervisor requests:', error);
        } else if (data && data.length > 0) {
            let activeRequests = data.filter(req => {
                // منع ظهور الطلب للمسؤول إذا كان هناك بديل لم يوافق بعد أو رفض التكليف
                if (req.substitute_id && req.substitute_status !== 'approved') {
                    return false;
                }
                if (req.modification_type === 'canceled') {
                    return req.cancellation_status === 'pending';
                }
                if (req.modification_type === 'cut') {
                    return req.cut_status === 'pending';
                }
                return req.status === 'pending';
            });
            const uniqueMap = new Map();
            activeRequests.forEach(req => { if (!uniqueMap.has(req.id)) uniqueMap.set(req.id, req); });
            activeRequests = Array.from(uniqueMap.values());

            if (activeRequests.length === 0) {
                setSupervisorRequests([]);
                setSupervisorPendingCount(0);
                return;
            }

            const validIds = activeRequests.map(r => r.user_id).filter(Boolean);
            const prevManagerIds = activeRequests.map(r => {
                if (r.approval_chain && Array.isArray(r.approval_chain) && r.current_approval_step > 1 && r.approval_chain[r.current_approval_step - 2]) {
                    return r.approval_chain[r.current_approval_step - 2];
                }
                return null;
            }).filter(Boolean);
            
            const userIds = [...new Set([...validIds, ...prevManagerIds])];
            const profileMap: Record<string, any> = {};

            if (userIds.length > 0) {
                const { data: profilesData } = await supabase.rpc('get_basic_profiles', { p_user_ids: userIds });
                if (profilesData) { (profilesData as any[]).forEach((p: any) => { profileMap[p.id] = p; }); }
            }

            const formattedData = activeRequests.map(item => {
                let prevManagerName = null;
                if (item.approval_chain && Array.isArray(item.approval_chain) && item.current_approval_step > 1 && item.approval_chain[item.current_approval_step - 2]) {
                    const prevId = item.approval_chain[item.current_approval_step - 2];
                    prevManagerName = profileMap[prevId]?.full_name;
                }
                return {
                    ...item,
                    profiles: item.user_id && profileMap[item.user_id] ? profileMap[item.user_id] : null,
                    prev_manager_name: prevManagerName
                };
            });
            setSupervisorRequests(formattedData);
            setSupervisorPendingCount(activeRequests.length);
        } else {
            setSupervisorRequests([]);
            setSupervisorPendingCount(0);
        }
    }, [user]);

    const fetchHRNotifications = useCallback(async () => {
        if (!user || user.id === 'visitor-id') return;

        // حصر استلام ومعاينة إشعارات الموارد البشرية بمسؤولي الـ HR الفعليين فقط
        const isAllowedRole = user.admin_role === 'hr' || user.admin_role === 'hr_supervisor';

        if (!isAllowedRole) return;

        // Fetch three types of requests for HR:
        // 1. Approved but not archived (waiting for printing)
        // 2. Cut requests waiting for HR approval
        // 3. Canceled requests that are approved (so HR knows it was canceled)
        const targetGov = typeof activeGovernorate === 'string' ? activeGovernorate : (activeGovernorate as any)?.id;
        let req = supabase
            .from('leave_requests')
            .select('*, profiles!inner(governorate)')
            .eq('is_read_by_hr', false)
            .or('and(status.eq.approved,is_archived.eq.false),hr_cut_status.eq.pending,cancellation_status.eq.approved');

        if (targetGov && targetGov !== 'all') {
            req = req.eq('profiles.governorate', targetGov);
        }

        const { data, error } = await req;

        if (error) {
            console.error('AppNotifications: Error fetching HR requests:', error);
        } else if (data && data.length > 0) {
            const validIds = data.map(r => r.user_id).filter(Boolean);
            const userIds = [...new Set(validIds)];
            const profileMap: Record<string, string> = {};

            if (userIds.length > 0) {
                const { data: profilesData } = await supabase
                    .rpc('get_basic_profiles', { p_user_ids: userIds });
                if (profilesData) (profilesData as any[]).forEach((p: any) => { profileMap[p.id] = p.full_name; });
            }

            const formatted = data.map(item => ({
                ...item,
                employee_name: profileMap[item.user_id] || 'موظف'
            }));

            setHrRequests(formatted);
        } else {
            setHrRequests([]);
        }
    }, [user, activeGovernorate]);

    const fetchSystemNotifications = useCallback(async () => {
        if (!user || user.id === 'visitor-id') return;

        let query = supabase
            .from('system_notifications')
            .select('*', { count: 'exact' })
            .eq('recipient_id', user.id)
            .eq('is_read', false)
            .neq('type', 'leave_response')
            .order('created_at', { ascending: false });

        // مشرف المالية: إشعار الاجازات والعمليات فقط — حجب إشعارات البصمة وتوثيق الموارد
        if (user.admin_role === 'finance') {
            query = query.not('type', 'in', '(device_mismatch,leave_hr,biometric_alert,leave_punch_alert,official_duty_punch)');
        }

        // حجب إشعارات توثيق الموارد البشرية (leave_hr) لغير مسؤولي الـ HR (مثل مشرف البصمة أو الموظف العادي)
        const isHrRole = user.admin_role === 'hr' || user.admin_role === 'hr_supervisor';
        if (!isHrRole) {
            query = query.neq('type', 'leave_hr');
        }

        const { data, count, error } = await query;

        if (error) {
            console.error('AppNotifications: Error fetching system notifications:', error);
        } else {
            setSystemNotifications(data || []);
            setSystemNotificationsCount(count || 0);
        }
    }, [user]);

    // Initial Fetch & Realtime Subscription
    useEffect(() => {
        if (!user || user.id === 'visitor-id') return;

        Promise.all([
            fetchEmployeeNotifications(),
            fetchSupervisorNotifications(),
            fetchHRNotifications(),
            fetchSystemNotifications()
        ]);

        const leaveChannel = supabase.channel('unified_leave_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
                fetchEmployeeNotifications();
                fetchSupervisorNotifications();
                fetchHRNotifications();
            })
            .subscribe();

        const systemChannel = supabase.channel('system_notifications_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'system_notifications', filter: `recipient_id=eq.${user.id}` }, () => {
                fetchSystemNotifications();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(leaveChannel).catch(() => {});
            supabase.removeChannel(systemChannel).catch(() => {});
        };
    }, [user, activeGovernorate, fetchEmployeeNotifications, fetchSupervisorNotifications, fetchHRNotifications, fetchSystemNotifications]);

    const totalNotifications = 
        supervisorPendingCount + 
        (hrRequests.filter(r => !dismissedHRRequestIds.has(r.id)).length) + 
        (employeeRequests.filter(r => !dismissedEmployeeRequestIds.has(r.id)).length) +
        systemNotificationsCount;

    // Actions
    const handleMarkSystemNotificationRead = async (id: string) => {
        try {
            const { error } = await supabase.from('system_notifications').update({ is_read: true }).eq('id', id);
            if (error) throw error;
            const updated = systemNotifications.filter(n => n.id !== id);
            setSystemNotifications(updated);
            setSystemNotificationsCount(updated.length);
        } catch (err) { }
    };

    const handleDismissEmployeeNotification = async (requestId: string) => {
        // Immediate UI feedback
        setDismissedEmployeeRequestIds(prev => {
            const next = new Set(prev);
            next.add(requestId);
            return next;
        });

        try {
            const { error } = await supabase.from('leave_requests').update({ is_read_by_employee: true }).eq('id', requestId);
            if (error) throw error;
            const updated = employeeRequests.filter(r => r.id !== requestId);
            setEmployeeRequests(updated);
            setEmployeeUnreadCount(updated.length);
            // If total drops to 0 after this (considering other lists), close modal
            // But totalNotifications is computed on render, so we check if it was 1
            if (totalNotifications <= 1) setShowModal(false);
        } catch (err) { }
    };

    const handleGoToUserRequests = (requestId: string) => {
        handleDismissEmployeeNotification(requestId);
        setShowModal(false);
        const event = new CustomEvent('navigate_to_user_requests');
        window.dispatchEvent(event);
    };

    const handleDismissAllEmployee = async () => {
        try {
            const ids = employeeRequests.map(r => r.id);
            const { error } = await supabase.from('leave_requests').update({ is_read_by_employee: true }).in('id', ids);
            if (error) throw error;
            setEmployeeRequests([]);
            setEmployeeUnreadCount(0);
            if (totalNotifications - employeeUnreadCount === 0) setShowModal(false);
        } catch (err) { }
    };


    const handleGoToAdminRequests = (requestId?: string, employeeId?: string) => {
        if (requestId) {
            setDismissedHRRequestIds(prev => {
                const next = new Set(prev);
                next.add(requestId);
                return next;
            });
            // Update database silently to dismiss for HR permanently
            supabase.from('leave_requests').update({ is_read_by_hr: true }).eq('id', requestId).then();
        }
        setShowModal(false);
        // Dispatching custom event with employeeId and requestId for automatic search and highlight
        const event = new CustomEvent('navigate_to_hr_requests', {
            detail: { employeeId, requestId }
        });
        window.dispatchEvent(event);
    };

    // ─── المحرك الذكي: أزرار إجراءات إشعارات البصمة ───

    /** زر «موافق»: ساعات المخالفة غير محتسبة + وسم السجل + إشعار الموظف بمراجعة الإدارة */
    const handleApproveLeaveConflict = async (notification: any) => {
        const meta = notification.metadata || {};
        if (!meta.employee_id || !meta.record_date) {
            toast.error('بيانات الإشعار غير مكتملة');
            return;
        }
        setSmartActionLoading(`conflict-${notification.id}`);
        try {
            const result = await approveLeaveConflict(meta.employee_id, meta.record_date);
            if (result.success) {
                toast.success(result.message);
                handleMarkSystemNotificationRead(notification.id);
            } else {
                toast.error(result.message);
            }
        } catch (err) {
            console.error('handleApproveLeaveConflict:', err);
            toast.error('تعذر إتمام العملية، حاول مجدداً');
        } finally {
            setSmartActionLoading(null);
        }
    };

    /** زر «مراجعة الطلب»: يفتح نموذج الاعتماد للطلب المعلق المرتبط بإشعار البصمة */
    const handleOpenPendingRequest = async (notification: any) => {
        const meta = notification.metadata || {};
        if (!meta.request_id) {
            toast.error('بيانات الإشعار غير مكتملة');
            return;
        }

        // تحسين: البحث في الطلبات المحملة مسبقاً لتجنب الاتصال بالشبكة وتسريع الفتح
        const existingReq = supervisorRequests.find(req => req.id === meta.request_id);
        if (existingReq) {
            setShowModal(false);
            setSelectedApprovalRequest(existingReq);
            // لا نوسم الإشعار كمقروء هنا بل يبقى فعالاً لحين اتخاذ الإجراء (موافقة/رفض) بنجاح
            return;
        }

        setSmartActionLoading(`pending-${notification.id}`);
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('id', meta.request_id)
                .maybeSingle();
            if (error) throw error;
            const isPending = data?.status === 'pending' || data?.cancellation_status === 'pending' || data?.cut_status === 'pending';
                                            if (!data || !isPending) {
                toast.error('الطلب لم يعد قيد المراجعة');
                handleMarkSystemNotificationRead(notification.id);
                return;
            }
            // نفس شكل طلبات المشرف في القائمة (profiles عبر get_basic_profiles)
            const { data: profilesData } = await supabase
                .rpc('get_basic_profiles', { p_user_ids: [data.user_id] });
            const shaped = {
                ...data,
                profiles: profilesData && profilesData.length > 0 ? profilesData[0] : null
            };
            setShowModal(false);
            setSmartApprovalRequest(shaped);
            // لا نوسم الإشعار كمقروء هنا بل يبقى فعالاً لحين اتخاذ الإجراء (موافقة/رفض) بنجاح
        } catch (err) {
            console.error('handleOpenPendingRequest:', err);
            toast.error('تعذر فتح الطلب، حاول مجدداً');
        } finally {
            setSmartActionLoading(null);
        }
    };

    const handleSubstituteResponse = async (notificationId: string, requestId: string, action: 'approve' | 'reject', rejectionReason?: string) => {
        try {
            setSmartActionLoading(`sub-${notificationId}`);
            const { data, error } = await supabase.rpc('respond_to_substitute_request', {
                p_request_id: requestId,
                p_action: action,
                p_rejection_reason: rejectionReason || null
            });

            if (error) throw error;
            const res = data as any;
            if (!res?.success) {
                toast.error(res?.message || 'تعذر معالجة الطلب');
                return;
            }

            toast.success(res?.message || (action === 'approve' ? 'تمت الموافقة بنجاح' : 'تم الاعتذار بنجاح'));
            await handleMarkSystemNotificationRead(notificationId);
        } catch (err: any) {
            console.error('Error responding to substitute request:', err);
            toast.error(err?.message || 'حدث خطأ أثناء معالجة الطلب');
        } finally {
            setSmartActionLoading(null);
        }
    };

    const handleServiceContinuitySupervisorResponse = async (notificationId: string, requestId: string, action: 'approve' | 'reject', notes?: string) => {
        try {
            setSmartActionLoading(`continuity-${notificationId}`);
            const { data, error } = await supabase.rpc('process_service_continuity_supervisor', {
                p_request_id: requestId,
                p_action: action,
                p_notes: notes || null
            });

            if (error) throw error;
            const res = data as any;
            if (!res?.success) {
                toast.error(res?.message || 'تعذر معالجة الطلب');
                return;
            }

            toast.success(res?.message || (action === 'approve' ? 'تمت الموافقة بنجاح وأحيل الطلب للموارد البشرية' : 'تم رفض الطلب بنجاح'));
            await handleMarkSystemNotificationRead(notificationId);
            fetchSystemNotifications();
        } catch (err: any) {
            console.error('Error responding to continuity request:', err);
            toast.error(err?.message || 'حدث خطأ أثناء معالجة الطلب');
        } finally {
            setSmartActionLoading(null);
        }
    };

    // إدارة صفة التعيين والنسخ لطلب الاستمرارية لدى مسؤول المالية
    const setNotificationCadre = (notifId: string, cadre: 'permanent' | 'contract') => {
        setFinanceCadreMap(prev => ({ ...prev, [notifId]: cadre }));
    };

    const handleAddCcRecipient = (notifId: string, customText?: string) => {
        const textToAdd = (customText !== undefined ? customText : (financeCcInputMap[notifId] || '')).trim();
        if (!textToAdd) return;
        setFinanceCcMap(prev => {
            const existing = prev[notifId] || [];
            if (existing.includes(textToAdd)) return prev;
            return { ...prev, [notifId]: [...existing, textToAdd] };
        });
        if (customText === undefined) {
            setFinanceCcInputMap(prev => ({ ...prev, [notifId]: '' }));
        }
    };

    const handleRemoveCcRecipient = (notifId: string, indexToRemove: number) => {
        setFinanceCcMap(prev => {
            const existing = prev[notifId] || [];
            return { ...prev, [notifId]: existing.filter((_, idx) => idx !== indexToRemove) };
        });
    };

    // إجراءات اعتماد ومراجعة وتعديل طلب الاستمرارية من قبل مسؤول الإدارة والمالية وبديله
    const handleFinanceContinuityApprove = async (notificationId: string, requestId: string) => {
        const cadreType = financeCadreMap[notificationId] || 'permanent';
        const ccRecipients = financeCcMap[notificationId] || [];
        try {
            setSmartActionLoading(`finance-app-${notificationId}`);
            const { data, error } = await supabase.rpc('approve_continuity_by_finance', {
                p_request_id: requestId,
                p_cadre_type: cadreType,
                p_cc_recipients: ccRecipients.length > 0 ? ccRecipients : null
            });
            if (error) throw error;
            const res = data as any;
            if (!res?.success) {
                toast.error(res?.message || 'تعذر اعتماد الطلب');
                return;
            }
            toast.success(res?.message || 'تمت الموافقة بنجاح وأحيل الطلب لموظف الطابعة');
            await handleMarkSystemNotificationRead(notificationId);
            fetchSystemNotifications();
        } catch (err: any) {
            console.error('Error approving continuity:', err);
            toast.error(err?.message || 'حدث خطأ أثناء اعتماد الطلب');
        } finally {
            setSmartActionLoading(null);
        }
    };

    const handleFinanceContinuityReject = async (notificationId: string, requestId: string) => {
        try {
            setSmartActionLoading(`finance-rej-${notificationId}`);
            const { data, error } = await supabase.rpc('reject_continuity_by_finance', {
                p_request_id: requestId,
                p_reason: financeRejectionReason.trim() || null
            });
            if (error) throw error;
            const res = data as any;
            if (!res?.success) {
                toast.error(res?.message || 'تعذر رفض الطلب');
                return;
            }
            toast.success(res?.message || 'تم رفض الطلب بنجاح وإشعار الموظف');
            setRejectingFinanceNotifId(null);
            setFinanceRejectionReason("");
            await handleMarkSystemNotificationRead(notificationId);
            fetchSystemNotifications();
        } catch (err: any) {
            console.error('Error rejecting continuity:', err);
            toast.error(err?.message || 'حدث خطأ أثناء رفض الطلب');
        } finally {
            setSmartActionLoading(null);
        }
    };

    const handleFinanceContinuityEdit = async (notificationId: string, requestId: string) => {
        if (!financeEditDestination.trim()) {
            toast.error('يرجى تحديد الجهة المعنون إليها الكتاب');
            return;
        }
        const cadreType = financeCadreMap[notificationId] || 'permanent';
        const ccRecipients = financeCcMap[notificationId] || [];
        try {
            setSmartActionLoading(`finance-edit-${notificationId}`);
            const { data, error } = await supabase.rpc('update_and_approve_continuity_by_finance', {
                p_request_id: requestId,
                p_destination_entity: financeEditDestination.trim(),
                p_notes: financeEditNotes.trim() || null,
                p_cadre_type: cadreType,
                p_cc_recipients: ccRecipients.length > 0 ? ccRecipients : null
            });
            if (error) throw error;
            const res = data as any;
            if (!res?.success) {
                toast.error(res?.message || 'تعذر حفظ التعديل');
                return;
            }
            toast.success(res?.message || 'تم حفظ التعديل واعتماد الطلب وإحالته للطابعة');
            setEditingFinanceNotifId(null);
            await handleMarkSystemNotificationRead(notificationId);
            fetchSystemNotifications();
        } catch (err: any) {
            console.error('Error updating continuity:', err);
            toast.error(err?.message || 'حدث خطأ أثناء حفظ التعديل');
        } finally {
            setSmartActionLoading(null);
        }
    };

    const handlePrintContinuityByOperator = async (notificationId: string, requestId: string) => {
        try {
            setSmartActionLoading(`finance-print-${notificationId}`);
            // جلب البيانات عبر الدالة الذرية المخصصة
            const { data: rpcRes, error: rpcErr } = await supabase.rpc('get_service_continuity_request_for_print', {
                p_request_id: requestId
            });

            let reqData: any = null;
            if (!rpcErr && rpcRes && (rpcRes as any).success && (rpcRes as any).request) {
                reqData = (rpcRes as any).request;
            } else {
                // الاستعلام الاحتياطي المباشر
                const { data, error } = await supabase
                    .from('service_continuity_requests')
                    .select(`
                        *,
                        employee:profiles!service_continuity_requests_user_id_fkey(
                            full_name,
                            job_number,
                            dept_text,
                            section_text,
                            gender
                        ),
                        supervisor:profiles!service_continuity_requests_supervisor_id_fkey(
                            full_name
                        )
                    `)
                    .eq('id', requestId)
                    .single();

                if (error || !data) {
                    // Fallback direct query if joins have any mismatch
                    const { data: rawReq, error: rawErr } = await supabase
                        .from('service_continuity_requests')
                        .select('*')
                        .eq('id', requestId)
                        .single();
                    if (rawErr || !rawReq) throw rawErr || new Error('تعذر العثور على سجل الطلب');

                    const { data: empProf } = await supabase
                        .from('profiles')
                        .select('id, full_name, job_number, dept_text, section_text, gender')
                        .eq('id', rawReq.user_id)
                        .maybeSingle();

                    reqData = {
                        ...rawReq,
                        employee: empProf || null
                    };
                } else {
                    reqData = data;
                }
            }

            if (!reqData) {
                throw new Error('تعذر تحميل بيانات كتاب الاستمرارية للطباعة');
            }

            // طباعة المستند مباشرة وحفظ كـ PDF فوراً بنقرة واحدة بدون أي واجهات وسيطة
            const printed = await printContinuityLetterDirect(reqData);
            if (printed) {
                // توثيق الطباعة رسمياً في قاعدة البيانات
                await supabase.rpc('mark_continuity_printed', { p_request_id: requestId });
                // تعليم الإشعار كمقروء
                await handleMarkSystemNotificationRead(notificationId);
                toast.success('تم فتح أمر طباعة / حفظ الكتاب بنجاح');
                fetchSystemNotifications();
            } else {
                toast.error('تعذر تجهيز نافذة الطباعة');
            }
        } catch (err: any) {
            console.error('Error printing continuity letter:', err);
            toast.error(err?.message || 'حدث خطأ أثناء طباعة كتاب الاستمرارية');
        } finally {
            setSmartActionLoading(null);
        }
    };

    const handleResolveShiftAbsenceOrPenalty = async (notificationId: string, decision: 'approve_leave' | 'unexcused_absence') => {
        try {
            setSmartActionLoading(`resolve-${notificationId}`);
            const { data, error } = await supabase.rpc('resolve_shift_absence_or_penalty', {
                p_notification_id: notificationId,
                p_decision: decision
            });

            if (error) throw error;
            const res = data as any;
            if (!res?.success) {
                toast.error(res?.message || 'تعذر معالجة القرار');
                return;
            }

            toast.success(res?.message || 'تم اعتماد القرار بنجاح');
            await handleMarkSystemNotificationRead(notificationId);
        } catch (err: any) {
            console.error('Error resolving shift absence or penalty:', err);
            toast.error(err?.message || 'حدث خطأ أثناء معالجة القرار');
        } finally {
            setSmartActionLoading(null);
        }
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="fixed bottom-[68px] left-3 md:bottom-[76px] md:left-4 z-[100] bg-white dark:bg-slate-800 w-12 h-12 md:w-14 md:h-14 rounded-full shadow-2xl border-2 border-indigo-500 transition-all duration-300 transform hover:scale-110 active:scale-95 group p-0 flex items-center justify-center focus:outline-none"
                title="الإشعارات الشاملة وسجل الحركات"
            >
                <div className="relative w-full h-full flex items-center justify-center">
                    <Bell className="text-gray-700 dark:text-gray-200" size={24} />
                    {totalNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 bg-indigo-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-lg animate-bounce">
                            {totalNotifications > 99 ? '99+' : totalNotifications}
                        </span>
                    )}
                </div>
                {totalNotifications > 0 && (
                    <div className="absolute inset-0 rounded-full border-[3px] border-indigo-500/50 animate-pulse pointer-events-none"></div>
                )}
            </button>

            {showModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pb-28 md:pb-32 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-9rem)] animate-in slide-in-from-bottom-5">
                        {/* Header */}
                        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Bell size={20} />
                                الإشعارات {totalNotifications > 0 ? `(${totalNotifications})` : ''}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowHistoryModal(true)}
                                    className="bg-indigo-700 hover:bg-indigo-800 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition border border-indigo-500/50 shadow-sm"
                                    title="استعراض مخزن وسجل الحركات"
                                >
                                    <Clock size={14} />
                                    <span>السجل</span>
                                </button>
                                <button onClick={() => setShowModal(false)} className="hover:bg-white/20 p-1 rounded-xl transition">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto p-4 flex-1 space-y-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">

                            {totalNotifications === 0 && (
                                <div className="flex flex-col items-center justify-center p-8 text-center opacity-90">
                                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                                        <Bell size={28} className="text-slate-400 dark:text-slate-500" />
                                    </div>
                                    <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-1">لا توجد إشعارات جديدة بانتظار الإجراء</h4>
                                    <p className="text-xs text-slate-500 mb-4">أنت على اطلاع بكل جديد، ويمكنك مراجعة السجل أو إعادة الطباعة في أي وقت.</p>
                                    <button
                                        type="button"
                                        onClick={() => { setShowModal(false); setShowHistoryModal(true); }}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                                    >
                                        <Clock size={15} />
                                        <span>فتح مخزن وسجل الإشعارات</span>
                                    </button>
                                </div>
                            )}


                            {/* Employee Personal Responses Section - أولوية قصوى تظهر في الأعلى أولاً */}
                            {employeeRequests.filter(r => !dismissedEmployeeRequestIds.has(r.id)).length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between border-b pb-1 dark:border-slate-700">
                                        <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-400">الردود على طلباتك</h4>
                                        <span className="text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                                            {employeeRequests.filter(r => !dismissedEmployeeRequestIds.has(r.id)).length} جديد
                                        </span>
                                    </div>
                                    {employeeRequests.filter(r => !dismissedEmployeeRequestIds.has(r.id)).map(req => {
                                        let isApproved = false;
                                        let requestType = 'إجازتك';
                                        
                                        if (req.cancellation_status && req.cancellation_status !== 'none') {
                                            isApproved = req.cancellation_status === 'approved';
                                            requestType = 'إلغاء إجازتك';
                                        } else if (req.cut_status && req.cut_status !== 'none') {
                                            isApproved = req.cut_status === 'approved';
                                            requestType = 'قطع إجازتك';
                                        } else {
                                            isApproved = req.status === 'approved';
                                            if (req.is_mandatory) {
                                                requestType = req.leave_type === 'time_off' ? 'إجازة زمنية إجبارية' : 'إجازة اعتيادية إجبارية';
                                            } else if (req.leave_type === 'time_off') {
                                                requestType = 'إجازتك الزمنية';
                                            } else if (req.leave_type === 'duty') {
                                                requestType = 'الواجب الرسمي';
                                            }
                                        }

                                        return (
                                            <div 
                                                key={req.id} 
                                                onClick={() => handleGoToUserRequests(req.id)}
                                                className={`bg-white dark:bg-slate-800 border-2 rounded-xl p-3 relative cursor-pointer hover:shadow-md transition-all ${req.is_mandatory ? 'border-amber-300 dark:border-amber-700 hover:bg-amber-50/40' : isApproved ? 'border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50/40' : 'border-rose-300 dark:border-rose-700 hover:bg-rose-50/40'} shadow-sm group`}
                                            >
                                                <div className="mb-1">
                                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full inline-block mb-1 shadow-sm ${req.is_mandatory ? 'text-amber-900 bg-amber-100 dark:bg-amber-900/70 dark:text-amber-200' : isApproved ? 'text-emerald-900 bg-emerald-100 dark:bg-emerald-900/70 dark:text-emerald-200' : 'text-rose-900 bg-rose-100 dark:bg-rose-900/70 dark:text-rose-200'}`}>
                                                        {req.is_mandatory
                                                            ? (req.leave_type === 'time_off' ? '⚠️ إجازة زمنية إجبارية' : '⚠️ إجازة اعتيادية إجبارية')
                                                            : req.leave_type === 'duty' 
                                                                ? (isApproved ? '✅ واجب رسمي معتمد' : '❌ واجب رسمي مرفوض')
                                                                : (isApproved ? '✅ موافق عليه' : '❌ مرفوض')}
                                                    </span>
                                                    <p className="text-xs text-slate-950 dark:text-white font-bold leading-relaxed group-hover:underline">
                                                        {requestType === 'قطع إجازتك' ? (() => {
                                                            let actual = 0;
                                                            let returned = 0;
                                                            if (req.cut_date && req.start_date) {
                                                                const start = new Date(req.start_date);
                                                                const cut = new Date(req.cut_date);
                                                                actual = Math.ceil((cut.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                                                if (actual < 0) actual = 0;
                                                                if (actual > req.days_count) actual = req.days_count;
                                                                returned = req.days_count - actual;
                                                            }
                                                            if (isApproved) {
                                                                return `لقد تم اعتماد طلب قطع إجازتك والمباشرة. الأيام الفعلية (${actual})، تم استرجاع (${returned}) يوم لرصيدك. الرصيد الحالي: ${(user as any)?.leave_balance || 0} يوم.`;
                                                            } else {
                                                                return `لقد تم رفض طلب قطع إجازتك. لا تزال الإجازة مستمرة (من ${req.start_date} إلى ${req.end_date}).`;
                                                            }
                                                        })() : req.is_mandatory ? (
                                                            req.leave_type === 'time_off'
                                                                ? `تم تقييد إجازة زمنية إجبارية في سجلك لتاريخ (${req.start_date}) لمدة (${req.time_duration_minutes} دقيقة) لتغطية التأخر الصباحي.`
                                                                : `تم تقييد إجازة اعتيادية إجبارية في سجلك لتاريخ (${req.start_date}) أصولياً لتغطية التأخر الصباحي الذي تجاوز الساعتين.`
                                                        ) : req.leave_type === 'duty' ? (
                                                            `لقد تم ${isApproved ? 'الموافقة على' : 'رفض'} طلب خروجك لتنفيذ واجب رسمي إلى (${req.destination || 'الجهة المحددة'}) بتاريخ (${req.start_date}).`
                                                        ) : req.leave_type === 'time_off' && requestType === 'إجازتك الزمنية' ? (
                                                            `لقد تم ${isApproved ? 'الموافقة على' : 'رفض'} طلب ${requestType} بتاريخ (${req.start_date}) لمدة (${req.time_duration_minutes} دقيقة).`
                                                        ) : (
                                                            `لقد تم ${isApproved ? 'الموافقة على' : 'رفض'} طلب ${requestType} (من ${req.start_date} إلى ${req.end_date}).`
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex justify-between items-center mt-2 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">انقر للمراجعة والمسح</span>
                                                    <CheckCircle size={14} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {employeeRequests.filter(r => !dismissedEmployeeRequestIds.has(r.id)).length > 1 && (
                                        <button
                                            onClick={handleDismissAllEmployee}
                                            className="w-full text-center text-xs font-black text-indigo-700 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl transition"
                                        >
                                            إخفاء جميع الردود
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* System Notifications Section */}
                            {systemNotifications.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 border-b pb-1 dark:border-slate-700">تنبيهات النظام</h4>
                                    {systemNotifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-indigo-200 dark:border-indigo-900/50 shadow-sm flex flex-col gap-2"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-full shrink-0">
                                                    <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h5 className="font-black text-sm text-slate-950 dark:text-white">
                                                        {notification.title}
                                                    </h5>
                                                    <p className="text-xs text-slate-900 dark:text-slate-100 font-bold mt-1 whitespace-pre-wrap leading-relaxed">
                                                        {notification.content}
                                                    </p>
                                                    <span className="text-xs text-slate-700 dark:text-slate-300 font-bold mt-2 block" dir="ltr" style={{ textAlign: 'right' }}>
                                                        {new Date(notification.created_at).toLocaleString('ar-IQ', {
                                                            year: 'numeric', month: '2-digit', day: '2-digit',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                            {(() => {
                                                const meta = notification.metadata || {};
                                                const metaType = meta.type as string | undefined;
                                                const hideBtn = (
                                                    <button
                                                        onClick={() => handleMarkSystemNotificationRead(notification.id)}
                                                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold transition shrink-0"
                                                    >
                                                        إخفاء
                                                    </button>
                                                );
                                                // بصمة متعارضة مع إجازة: زر «موافق» → ساعات غير محتسبة + وسم + إشعار الموظف
                                                if (metaType === 'leave_punch_alert') {
                                                    return (
                                                        <div className="flex gap-2 mt-1">
                                                            <button
                                                                disabled={smartActionLoading === `conflict-${notification.id}`}
                                                                onClick={() => handleApproveLeaveConflict(notification)}
                                                                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                            >
                                                                <CheckCircle size={14} />
                                                                {smartActionLoading === `conflict-${notification.id}` ? 'جارٍ الاعتماد...' : 'موافق'}
                                                            </button>
                                                            {hideBtn}
                                                        </div>
                                                    );
                                                }
                                                // بصمة مع طلب معلق: فتح نموذج الاعتماد مباشرة
                                                if (metaType === 'pending_request_punch') {
                                                    return (
                                                        <div className="flex gap-2 mt-1">
                                                            <button
                                                                disabled={smartActionLoading === `pending-${notification.id}`}
                                                                onClick={() => handleOpenPendingRequest(notification)}
                                                                className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                            >
                                                                <CheckCircle size={14} />
                                                                {smartActionLoading === `pending-${notification.id}` ? 'جارٍ الفتح...' : 'مراجعة الطلب'}
                                                            </button>
                                                            {hideBtn}
                                                        </div>
                                                    );
                                                }
                                                if (notification.type === 'leave_request') {
                                                    return (
                                                        <div className="flex gap-2 mt-1">
                                                            <button
                                                                disabled={smartActionLoading === `pending-${notification.id}`}
                                                                onClick={() => handleOpenPendingRequest(notification)}
                                                                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                            >
                                                                <CheckCircle size={14} />
                                                                {smartActionLoading === `pending-${notification.id}` ? 'جارٍ الفتح...' : 'مراجعة/إجراء'}
                                                            </button>
                                                            {hideBtn}
                                                        </div>
                                                    );
                                                }
                                                if (notification.type === 'device_mismatch') {
                                                    return (
                                                        <div className="flex gap-2 mt-1">
                                                            <button
                                                                onClick={() => {
                                                                    handleMarkSystemNotificationRead(notification.id);
                                                                    setShowModal(false);
                                                                    sessionStorage.setItem('attendance_pending_subtab', 'deviceRequests');
                                                                    window.dispatchEvent(new CustomEvent('switch_dashboard_tab', { detail: { tab: 'admin_attendance' } }));
                                                                    window.dispatchEvent(new CustomEvent('switch_attendance_subtab', { detail: { subTab: 'deviceRequests' } }));
                                                                }}
                                                                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                                                            >
                                                                <CheckCircle size={14} />
                                                                مراجعة طلب الجهاز
                                                            </button>
                                                            {hideBtn}
                                                        </div>
                                                    );
                                                }
                                                if (notification.type === 'substitute_request') {
                                                    const reqId = meta.request_id;
                                                    const isLoadingThis = smartActionLoading === `sub-${notification.id}`;
                                                    return (
                                                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                                                            <div className="flex gap-2">
                                                                <button
                                                                    disabled={isLoadingThis}
                                                                    onClick={() => handleSubstituteResponse(notification.id, reqId, 'approve')}
                                                                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                                >
                                                                    <CheckCircle size={15} />
                                                                    {isLoadingThis ? 'جارٍ الاعتماد...' : 'موافقة على التكليف كبديل'}
                                                                </button>
                                                                <button
                                                                    disabled={isLoadingThis}
                                                                    onClick={() => {
                                                                        const reason = window.prompt('سبب الاعتذار (اختياري):');
                                                                        if (reason !== null) {
                                                                            handleSubstituteResponse(notification.id, reqId, 'reject', reason);
                                                                        }
                                                                    }}
                                                                    className="py-2 px-3 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition disabled:opacity-60"
                                                                >
                                                                    اعتذار
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                // إشعار مسؤول القسم المالي والإداري وبديله لطلب تأييد الاستمرارية بالخدمة
                                                const isFinanceContinuity = notification.type === 'service_continuity_finance' || (notification.type === 'service_continuity_request' && meta.continuity_step === 'finance');
                                                if (isFinanceContinuity) {
                                                    const reqId = meta.request_id;
                                                    const isLoadingThis = smartActionLoading?.startsWith('finance-') && smartActionLoading?.includes(notification.id);
                                                    const isRejecting = rejectingFinanceNotifId === notification.id;
                                                    const isEditing = editingFinanceNotifId === notification.id;
                                                    const currentCadre = financeCadreMap[notification.id] || 'permanent';
                                                    const currentCcList = financeCcMap[notification.id] || [];
                                                    const currentCcInput = financeCcInputMap[notification.id] || '';

                                                    return (
                                                        <div className="flex flex-col gap-2.5 mt-2 pt-2 border-t border-cyan-100 dark:border-cyan-900/40">
                                                            {/* عرض الغرض أو الملاحظات إن وُجدت */}
                                                            {meta?.notes && (
                                                                <div className="flex items-start gap-1.5 p-2 rounded-lg bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-800/60 text-xs text-slate-800 dark:text-slate-200">
                                                                    <span className="font-bold text-cyan-950 dark:text-cyan-200 shrink-0">الغرض:</span>
                                                                    <span className="font-semibold">{meta.notes}</span>
                                                                </div>
                                                            )}

                                                            {/* أزرار تحديد صفة التعيين: ملاك دائم / عقود */}
                                                            <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">صفة التعيين في الكتاب:</span>
                                                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                                                        {currentCadre === 'contract' ? 'سيظهر: (بصفة عقد)' : 'سيظهر: (على الملاك الدائم)'}
                                                                    </span>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setNotificationCadre(notification.id, 'permanent')}
                                                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border ${
                                                                            currentCadre === 'permanent'
                                                                                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                                                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                                        }`}
                                                                    >
                                                                        <span>الملاك الدائم (افتراضي)</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setNotificationCadre(notification.id, 'contract')}
                                                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border ${
                                                                            currentCadre === 'contract'
                                                                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                                                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                                        }`}
                                                                    >
                                                                        <span>عقود</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* حقل إدخال جهات (نسخة منه إلى) مع اقتراحات سريعة */}
                                                            <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                                                                <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                                                                    أدخل نسخة منه إلى (اختياري):
                                                                </label>
                                                                <div className="flex gap-1.5">
                                                                    <input
                                                                        type="text"
                                                                        value={currentCcInput}
                                                                        onChange={(e) => setFinanceCcInputMap(prev => ({ ...prev, [notification.id]: e.target.value }))}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                handleAddCcRecipient(notification.id);
                                                                            }
                                                                        }}
                                                                        placeholder="اكتب الجهة، مثل: الإضبارة الشخصية"
                                                                        className="flex-1 p-1.5 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleAddCcRecipient(notification.id)}
                                                                        className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shrink-0"
                                                                    >
                                                                        إضافة
                                                                    </button>
                                                                </div>

                                                                {/* اقتراحات سريعة بنقرة واحدة */}
                                                                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">اقتراح سريع:</span>
                                                                    {['الإضبارة الشخصية', 'المومأ إليه', 'ديوان محافظة كربلاء'].map(suggest => (
                                                                        <button
                                                                            key={suggest}
                                                                            type="button"
                                                                            onClick={() => handleAddCcRecipient(notification.id, suggest)}
                                                                            className="text-[10px] font-bold py-0.5 px-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                                                                        >
                                                                            + {suggest}
                                                                        </button>
                                                                    ))}
                                                                </div>

                                                                {/* قائمة النسخ المضافة */}
                                                                {currentCcList.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-1 pt-1.5 border-t border-indigo-100 dark:border-indigo-900/40">
                                                                        {currentCcList.map((cc, idx) => (
                                                                            <span
                                                                                key={idx}
                                                                                className="inline-flex items-center gap-1 py-0.5 px-2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 rounded-md text-[11px] font-bold"
                                                                            >
                                                                                <span>{cc}</span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveCcRecipient(notification.id, idx)}
                                                                                    className="text-indigo-600 dark:text-indigo-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold ml-0.5"
                                                                                    title="حذف"
                                                                                >
                                                                                    ×
                                                                                </button>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* الأزرار التفاعلية الثلاثة */}
                                                            {!isRejecting && !isEditing && (
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <button
                                                                        disabled={isLoadingThis}
                                                                        onClick={() => handleFinanceContinuityApprove(notification.id, reqId)}
                                                                        className="flex-1 min-w-[70px] py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm disabled:opacity-60"
                                                                        title="موافقة واعتماد فوري وإحالة للطباعة"
                                                                    >
                                                                        <CheckCircle size={15} />
                                                                        موافق
                                                                    </button>

                                                                    <button
                                                                        disabled={isLoadingThis}
                                                                        onClick={() => {
                                                                            setRejectingFinanceNotifId(null);
                                                                            setEditingFinanceNotifId(notification.id);
                                                                            setFinanceEditDestination(meta.destination_entity || '');
                                                                            setFinanceEditNotes(meta.notes || '');
                                                                        }}
                                                                        className="py-2 px-3.5 bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold transition disabled:opacity-60 flex items-center gap-1"
                                                                        title="تعديل الجهة المعنون إليها أو الملاحظات"
                                                                    >
                                                                        <Edit2 size={14} />
                                                                        تعديل
                                                                    </button>

                                                                    <button
                                                                        disabled={isLoadingThis}
                                                                        onClick={() => {
                                                                            setEditingFinanceNotifId(null);
                                                                            setRejectingFinanceNotifId(notification.id);
                                                                            setFinanceRejectionReason("");
                                                                        }}
                                                                        className="py-2 px-3.5 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition disabled:opacity-60 flex items-center gap-1"
                                                                        title="رفض الطلب مع بيان السبب"
                                                                    >
                                                                        <X size={14} />
                                                                        رفض
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* حقل الرفض المدمج مع حقل النص حتى 256 حرف */}
                                                            {isRejecting && (
                                                                <div className="flex flex-col gap-1.5 p-2 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg animate-in fade-in duration-200">
                                                                    <div className="flex justify-between items-center text-[11px] font-bold text-rose-900 dark:text-rose-200">
                                                                        <span>سبب الرفض (اختياري):</span>
                                                                        <span className="text-[10px] text-slate-500 font-mono">{financeRejectionReason.length}/256</span>
                                                                    </div>
                                                                    <textarea
                                                                        value={financeRejectionReason}
                                                                        onChange={(e) => setFinanceRejectionReason(e.target.value.slice(0, 256))}
                                                                        placeholder="اكتب سبب الرفض هنا ليظهر للموظف..."
                                                                        rows={2}
                                                                        className="w-full p-1.5 text-xs rounded border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-rose-500"
                                                                        autoFocus
                                                                    />
                                                                    <div className="flex gap-1.5 justify-end">
                                                                        <button
                                                                            disabled={isLoadingThis}
                                                                            onClick={() => handleFinanceContinuityReject(notification.id, reqId)}
                                                                            className="py-1 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition flex items-center gap-1 disabled:opacity-60"
                                                                        >
                                                                            <X size={13} />
                                                                            تأكيد الرفض
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setRejectingFinanceNotifId(null)}
                                                                            className="py-1 px-2.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded text-xs font-bold hover:bg-gray-300 transition"
                                                                        >
                                                                            إلغاء
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* حقول التعديل المدمجة */}
                                                            {isEditing && (
                                                                <div className="flex flex-col gap-2 p-2.5 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg animate-in fade-in duration-200">
                                                                    <div className="flex flex-col gap-1">
                                                                        <label className="text-[11px] font-bold text-sky-950 dark:text-sky-200">
                                                                            الجهة المعنون إليها الكتاب:
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={financeEditDestination}
                                                                            onChange={(e) => setFinanceEditDestination(e.target.value)}
                                                                            placeholder="مثال: مصرف الرافدين / فرع كربلاء"
                                                                            className="w-full p-1.5 text-xs rounded border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-sky-500"
                                                                            autoFocus
                                                                        />
                                                                    </div>
                                                                    <div className="flex flex-col gap-1">
                                                                        <label className="text-[11px] font-bold text-sky-950 dark:text-sky-200">
                                                                            ملاحظات إضافية أو الغرض (اختياري):
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={financeEditNotes}
                                                                            onChange={(e) => setFinanceEditNotes(e.target.value)}
                                                                            placeholder="مثال: كفالة السيد محمد علي..."
                                                                            className="w-full p-1.5 text-xs rounded border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-sky-500"
                                                                        />
                                                                    </div>
                                                                    <div className="flex gap-1.5 justify-end">
                                                                        <button
                                                                            disabled={isLoadingThis}
                                                                            onClick={() => handleFinanceContinuityEdit(notification.id, reqId)}
                                                                            className="py-1 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-bold transition flex items-center gap-1 disabled:opacity-60"
                                                                        >
                                                                            <CheckCircle size={13} />
                                                                            حفظ واعتماد وإحالة للطابعة
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEditingFinanceNotifId(null)}
                                                                            className="py-1 px-2.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded text-xs font-bold hover:bg-gray-300 transition"
                                                                        >
                                                                            إلغاء
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                {/* إشعار موظف الطابعة الجاهز للطباعة المباشرة */}
                                                if (notification.type === 'service_continuity_print') {
                                                    const reqId = meta.request_id;
                                                    const isLoadingThis = smartActionLoading === `finance-print-${notification.id}`;
                                                    return (
                                                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                                                            {/* عرض الغرض أو الملاحظات إن وُجدت */}
                                                            {meta?.notes && (
                                                                <div className="flex items-start gap-1.5 p-2 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-slate-800 dark:text-slate-200">
                                                                    <span className="font-bold text-indigo-950 dark:text-indigo-200 shrink-0">الغرض:</span>
                                                                    <span className="font-semibold">{meta.notes}</span>
                                                                </div>
                                                            )}
                                                            <button
                                                                disabled={isLoadingThis}
                                                                onClick={() => handlePrintContinuityByOperator(notification.id, reqId)}
                                                                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
                                                            >
                                                                <Printer size={16} />
                                                                {isLoadingThis ? 'جارٍ فتح أمر الطباعة / التصدير...' : 'طباعة الكتاب الرسمي (A4 / PDF)'}
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                const isSupervisorActionable = (notification.type === 'service_continuity_request' || meta.request_type === 'service_continuity') && meta.continuity_step !== 'hr' && !notification.title.includes('جاهز للإصدار');
                                                if (isSupervisorActionable) {
                                                    const reqId = meta.request_id;
                                                    const isLoadingThis = smartActionLoading === `continuity-${notification.id}`;
                                                    return (
                                                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-cyan-100 dark:border-cyan-900/40">
                                                            <div className="flex gap-2">
                                                                <button
                                                                    disabled={isLoadingThis}
                                                                    onClick={() => handleServiceContinuitySupervisorResponse(notification.id, reqId, 'approve')}
                                                                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                                >
                                                                    <CheckCircle size={15} />
                                                                    {isLoadingThis ? 'جارٍ الاعتماد...' : 'موافقة'}
                                                                </button>
                                                                <button
                                                                    disabled={isLoadingThis}
                                                                    onClick={() => {
                                                                        const reason = window.prompt('سبب الرفض (اختياري):');
                                                                        if (reason !== null) {
                                                                            handleServiceContinuitySupervisorResponse(notification.id, reqId, 'reject', reason);
                                                                        }
                                                                    }}
                                                                    className="py-2 px-4 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition disabled:opacity-60"
                                                                >
                                                                    رفض
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                if (meta.requires_decision || meta.type === 'shift_absence_resolution' || meta.type === 'mandatory_penalty_decision') {
                                                    const isLoadingThis = smartActionLoading === `resolve-${notification.id}`;
                                                    const daysCount = meta.days_count || 1;
                                                    return (
                                                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-amber-200 dark:border-amber-900/50">
                                                            <div className="flex flex-col sm:flex-row gap-2">
                                                                <button
                                                                    disabled={isLoadingThis}
                                                                    onClick={() => handleResolveShiftAbsenceOrPenalty(notification.id, 'approve_leave')}
                                                                    className="flex-1 py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
                                                                >
                                                                    <CheckCircle size={15} />
                                                                    {isLoadingThis ? 'جارٍ الاعتماد...' : `اعتماد كإجازة (${daysCount} يوم)`}
                                                                </button>
                                                                <button
                                                                    disabled={isLoadingThis}
                                                                    onClick={() => handleResolveShiftAbsenceOrPenalty(notification.id, 'unexcused_absence')}
                                                                    className="flex-1 py-2 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
                                                                >
                                                                    <X size={15} />
                                                                    {isLoadingThis ? 'جارٍ المعالجة...' : `اعتماد كغياب (${daysCount} يوم)`}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                // إشعارات الفحص اليومي للشفت الصباحي: زر «اطلعت» لحفظ الإشعار وأرشفته
                                                if (metaType === 'morning_attendance_alert' || notification.type?.startsWith('attendance_morning_')) {
                                                    return (
                                                        <button
                                                            onClick={() => handleMarkSystemNotificationRead(notification.id)}
                                                            className="w-full mt-2 py-2 px-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                                                        >
                                                            <CheckCircle size={15} />
                                                            اطلعت
                                                        </button>
                                                    );
                                                }
                                                return (
                                                    <button
                                                        onClick={() => handleMarkSystemNotificationRead(notification.id)}
                                                        className="w-full mt-1 py-1.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition flex items-center justify-center gap-1.5"
                                                    >
                                                        <CheckCircle size={14} className="text-slate-400" />
                                                        علم (إخفاء)
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Supervisor Requests Section */}
                            {supervisorRequests.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 border-b pb-1 dark:border-slate-700">طلبات بانتظار موافقتك</h4>
                                    {supervisorRequests.map(req => (
                                        <div
                                            key={req.id}
                                            onClick={() => { setShowModal(false); setSelectedApprovalRequest(req); }}
                                            className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-amber-200 dark:border-amber-900/50 shadow-sm cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex justify-between items-center"
                                        >
                                            <div className="flex-1">
                                                <h5 className="font-black text-sm text-slate-950 dark:text-white">
                                                    {req.profiles?.full_name || 'موظف'}
                                                </h5>
                                                <p className="text-xs text-slate-900 dark:text-slate-100 font-bold mt-0.5">
                                                    {req.cancellation_status === 'pending' || req.modification_type === 'canceled' ? `طالب بإلغاء إجازته (${getLeaveTypeName(req.leave_type, req.time_off_subtype, req.is_mandatory)})` :
                                                        req.cut_status === 'pending' || req.modification_type === 'cut' ? 
                                                        (() => {
                                                            let actual = 0;
                                                            let returned = 0;
                                                            if (req.cut_date && req.start_date) {
                                                                const start = new Date(req.start_date);
                                                                const cut = new Date(req.cut_date);
                                                                actual = Math.ceil((cut.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                                                if (actual < 0) actual = 0;
                                                                if (actual > req.days_count) actual = req.days_count;
                                                                returned = req.days_count - actual;
                                                            }
                                                            return `طالب بقطع إجازته والمباشرة (الفعلية: ${actual} يوم، يتم إرجاع: ${returned} يوم)`;
                                                        })()
                                                        : req.leave_type === 'duty' ? `طالب بالخروج لتنفيذ واجب رسمي إلى (${req.destination || 'جهة رسمية'}) بتاريخ (${req.start_date})`
                                                        : `طالب بـ ${getLeaveTypeName(req.leave_type, req.time_off_subtype, req.is_mandatory)} لمدة ${req.leave_type === 'time_off' ? (req.time_duration_minutes + ' دقيقة') : (req.days_count + ' يوم')}`}
                                                </p>
                                                {(req.unpaid_days ?? 0) > 0 && (
                                                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-1">
                                                        ⚠️ منها ({req.unpaid_days}) أيام بدون راتب
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                className="bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ml-2 shrink-0 pointer-events-none"
                                            >
                                                مراجعة
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* HR Dashboard Individual Requests */}
                            {hrRequests.filter(r => !dismissedHRRequestIds.has(r.id)).length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 border-b pb-1 dark:border-slate-700">إشعارات الموارد البشرية</h4>
                                    {hrRequests.filter(r => !dismissedHRRequestIds.has(r.id)).map(req => (
                                        <div
                                            key={req.id}
                                            onClick={() => handleGoToAdminRequests(req.id, req.user_id)}
                                            className={`relative overflow-hidden rounded-xl p-3 border cursor-pointer hover:shadow-md transition-all group flex justify-between items-center ${req.cancellation_status === 'approved' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800/50'}`}
                                        >
                                            {req.cancellation_status === 'approved' && (
                                                <div className="absolute top-0 right-0 left-0 bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 text-[10px] font-bold text-center py-0.5">
                                                    تم إلغاء الإجازة
                                                </div>
                                            )}
                                            <div className={`flex-1 ${req.cancellation_status === 'approved' ? 'mt-2' : ''}`}>
                                                <h5 className="font-bold text-sm text-blue-700 dark:text-blue-400 group-hover:underline">
                                                    {req.employee_name}
                                                </h5>
                                                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                                                    {req.cancellation_status === 'approved' ? 'تم إلغاء الإجازة (للعلم والتسوية)' : req.hr_cut_status === 'pending' ? 'بانتظار اعتماد قطع الإجازة' : 'إجازة معتمدة بانتظار الطباعة'}
                                                </p>
                                            </div>
                                            <div className="bg-blue-100 dark:bg-blue-900/40 p-1.5 rounded-lg">
                                                <CheckCircle size={16} className="text-blue-600 dark:text-blue-400" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}



                        </div>
                    </div>
                </div>
            )}

            {/* Render Supervisor Approval Modal Outside Main Dialog so it doesn't pile modals */}
            {selectedApprovalRequest && (
                <ApprovalModal
                    request={selectedApprovalRequest}
                    onClose={() => setSelectedApprovalRequest(null)}
                    onProcessed={() => {
                        fetchSupervisorNotifications();
                    }}
                />
            )}

            {/* نموذج الاعتماد المفتوح من زر «مراجعة الطلب» في الإشعارات الذكية */}
            {smartApprovalRequest && (
                <ApprovalModal
                    request={smartApprovalRequest}
                    onClose={() => setSmartApprovalRequest(null)}
                    onProcessed={() => {
                        fetchSupervisorNotifications();
                    }}
                />
            )}

            {/* مخزن وسجل حركات الإشعارات */}
            {showHistoryModal && (
                <NotificationHistoryModal
                    onClose={() => setShowHistoryModal(false)}
                />
            )}
        </>
    );
};








