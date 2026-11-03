import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Loader2, Trash2, Shield, User, ClipboardCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useEmployeeSearch } from '../../hooks/useEmployeeSearch';
import { useGovernorate } from '../../context/GovernorateContext';
import { governorateName } from '../../constants/governorates';

interface RequestsTabPermissionsModalProps {
    onClose: () => void;
    theme: string;
}

export const RequestsTabPermissionsModal: React.FC<RequestsTabPermissionsModalProps> = ({ onClose, theme }) => {
    const { activeGovernorate } = useGovernorate();
    const currentGovName = governorateName(activeGovernorate);

    // البحث المباشر في جدول profiles لجلب حقل can_view_requests
    const { query: searchQuery, setQuery: setSearchQuery, results: searchResults, isSearching } = useEmployeeSearch({
        selectFields: 'id, full_name, job_number, role, can_view_requests',
        limit: 10,
        debounceMs: 300,
        usePublicView: false,
        governorate: activeGovernorate
    });

    const [allowedUsers, setAllowedUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [filterQuery, setFilterQuery] = useState('');
    const [isGrantingId, setIsGrantingId] = useState<string | null>(null);

    // حالة التفعيل الشامل للكل
    const [isAllEnabled, setIsAllEnabled] = useState(false);
    const [isLoadingAllStatus, setIsLoadingAllStatus] = useState(true);
    const [isTogglingAll, setIsTogglingAll] = useState(false);
    const [totalEmployeesInGov, setTotalEmployeesInGov] = useState(0);

    // حالة حوار التأكيد
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'enable' | 'disable'>('enable');

    // فحص حالة التفعيل الشامل للمحافظة الحالية
    const fetchAllStatus = async () => {
        setIsLoadingAllStatus(true);
        try {
            const { data, error } = await supabase.rpc('get_requests_tab_all_status', { 
                p_governorate: activeGovernorate 
            });
            if (error) throw error;
            if (data) {
                setIsAllEnabled(Boolean(data.is_all_enabled));
                setTotalEmployeesInGov(data.total_employees || 0);
            }
        } catch (e) {
            console.error('Error fetching requests tab all status:', e);
        } finally {
            setIsLoadingAllStatus(false);
        }
    };

    // جلب قائمة المسموح لهم بالتخصيص الفردي
    const fetchAllowedUsers = async () => {
        setIsLoadingUsers(true);
        try {
            let query = supabase
                .from('profiles')
                .select('id, full_name, job_number, role, can_view_requests')
                .eq('can_view_requests', true);

            if (activeGovernorate && activeGovernorate !== 'all') {
                query = query.eq('governorate', activeGovernorate);
            }

            const { data, error } = await query.order('full_name');

            if (error) throw error;
            setAllowedUsers(data || []);
        } catch (error: any) {
            console.error('Error fetching allowed users:', error);
            toast.error('حدث خطأ أثناء جلب قائمة المستخدمين');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    useEffect(() => {
        fetchAllStatus();
        fetchAllowedUsers();
    }, [activeGovernorate]);

    // التحقق الموحد مما إذا كان المستخدم مضافاً مسبقاً
    const isUserAllowed = (userId: string, canView?: boolean) => {
        return isAllEnabled || Boolean(canView) || allowedUsers.some(u => u.id === userId);
    };

    // معالجة النقر على مربع التفعيل للكل
    const handleCheckboxClick = () => {
        if (isAllEnabled) {
            setConfirmAction('disable');
        } else {
            setConfirmAction('enable');
        }
        setShowConfirmModal(true);
    };

    // تنفيذ التفعيل أو الإلغاء الشامل بعد التأكيد
    const executeToggleAll = async () => {
        setIsTogglingAll(true);
        const targetState = confirmAction === 'enable';
        try {
            const { data, error } = await supabase.rpc('toggle_requests_tab_all', {
                p_governorate: activeGovernorate,
                p_enable: targetState
            });
            if (error) throw error;

            setIsAllEnabled(targetState);
            toast.success(
                targetState
                    ? `تم التفعيل بنجاح لجميع موظفي ${currentGovName} (${data?.affected_count || totalEmployeesInGov} موظفاً)`
                    : `تم إلغاء التفعيل الشامل لموظفي ${currentGovName} والعودة للتخصيص اليدوي`
            );
            setShowConfirmModal(false);
            setSearchQuery('');
            fetchAllowedUsers();
        } catch (error: any) {
            console.error('Error toggling requests tab all:', error);
            toast.error('حدث خطأ أثناء تحديث حالة التفعيل الشامل');
        } finally {
            setIsTogglingAll(false);
        }
    };

    const handleGrantPermission = async (user: any) => {
        if (isAllEnabled) return;
        if (user.role === 'admin') {
            toast.error('هذا المستخدم "مشرف" ولديه صلاحية رؤية التبويبة مسبقاً.');
            return;
        }
        if (isUserAllowed(user.id, user.can_view_requests)) {
            toast.error('هذا المستخدم مضاف بالفعل ولديه الصلاحية.');
            return;
        }

        setIsGrantingId(user.id);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ can_view_requests: true })
                .eq('id', user.id);

            if (error) throw error;

            toast.success(`تم منح الصلاحية لـ ${user.full_name}`);
            
            // إضافة المستخدم فوراً إلى قمة القائمة المحلية
            const newUser = { ...user, can_view_requests: true };
            setAllowedUsers(prev => [newUser, ...prev.filter(u => u.id !== user.id)]);
        } catch (error: any) {
            console.error('Error updating permission:', error);
            toast.error('فشل في منح الصلاحية');
        } finally {
            setIsGrantingId(null);
        }
    };

    const handleRevokePermission = async (userId: string, userName: string) => {
        if (isAllEnabled) return;
        const confirmResult = window.confirm(`هل أنت متأكد من إزالة الصلاحية لـ ${userName}؟`);
        if (!confirmResult) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ can_view_requests: false })
                .eq('id', userId);

            if (error) throw error;

            toast.success(`تم إزالة الصلاحية بنجاح لـ ${userName}`);
            setAllowedUsers(prev => prev.filter(u => u.id !== userId));
        } catch (error: any) {
            console.error('Error updating permission:', error);
            toast.error('فشل في إزالة الصلاحية');
        }
    };

    // تصفية القائمة المحلية عند البحث داخلها
    const filteredAllowedUsers = useMemo(() => {
        if (!filterQuery.trim()) return allowedUsers;
        const q = filterQuery.trim().toLowerCase();
        return allowedUsers.filter(u => 
            (u.full_name && u.full_name.toLowerCase().includes(q)) ||
            (u.job_number && u.job_number.includes(q))
        );
    }, [allowedUsers, filterQuery]);

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pb-28 md:pb-32 pt-4 overflow-y-auto">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={cn(
                "relative w-full max-w-2xl rounded-2xl shadow-2xl p-6 flex flex-col max-h-[calc(100vh-9rem)] overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                theme === 'light' ? 'bg-white text-gray-900 border border-gray-200' : 'bg-zinc-900 text-white border border-white/10'
            )}>
                <button onClick={onClose} className="absolute left-6 top-6 p-2 rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/10">
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-brand-green/10 text-brand-green rounded-xl">
                        <ClipboardCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">تحديد مستخدمي تبويبة الطلبات</h2>
                        <p className={cn("text-sm", theme === 'light' ? "text-gray-500" : "text-white/50")}>
                            السماح للموظفين برؤية تبويبة "الطلبات" في {currentGovName} (بمستوى صلاحية user).
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    {/* Search Field & Toggle All Section */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold block">إضافة موظف للحاوية</label>
                            {isAllEnabled && (
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-green/20 text-brand-green font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    مفعل للكل في {currentGovName}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Search Input Container */}
                            <div className="relative flex-1">
                                <Search className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4", theme === 'light' ? "text-gray-400" : "text-white/40")} />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={isAllEnabled ? "حقل البحث غير فعال (التفعيل الشامل نشط للكل)..." : "ابحث بالاسم أو الرقم الوظيفي للترشيح والإضافة..."}
                                    className={cn(
                                        "pl-3 pr-10 transition-all",
                                        isAllEnabled && "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-zinc-800/60"
                                    )}
                                    disabled={isAllEnabled || isTogglingAll || isLoadingAllStatus}
                                    autoFocus={!isAllEnabled}
                                />
                            </div>

                            {/* Checkbox: تفعيل للكل */}
                            <div
                                onClick={() => !isTogglingAll && !isLoadingAllStatus && handleCheckboxClick()}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 h-10 rounded-xl border cursor-pointer select-none transition-all duration-200 shrink-0",
                                    isAllEnabled 
                                        ? "bg-brand-green/15 border-brand-green/40 text-brand-green font-bold shadow-sm"
                                        : theme === 'light' 
                                            ? "bg-white border-gray-200 hover:border-brand-green/40 hover:bg-gray-50 text-gray-700 font-semibold"
                                            : "bg-zinc-800/80 border-white/10 hover:border-brand-green/40 hover:bg-zinc-800 text-white/80 font-semibold",
                                    (isTogglingAll || isLoadingAllStatus) && "opacity-50 cursor-wait"
                                )}
                                title={`تفعيل تبويبة الطلبات لجميع الموظفين في ${currentGovName}`}
                            >
                                <div className={cn(
                                    "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                    isAllEnabled 
                                        ? "bg-brand-green border-brand-green text-white shadow-sm"
                                        : theme === 'light' ? "border-gray-300 bg-white" : "border-white/20 bg-black/40"
                                )}>
                                    {isTogglingAll || isLoadingAllStatus ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-green" />
                                    ) : isAllEnabled ? (
                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                    ) : null}
                                </div>
                                <span className="text-xs sm:text-sm whitespace-nowrap">
                                    تفعيل للكل
                                </span>
                            </div>
                        </div>

                        {/* Search Results Dropdown-like UI */}
                        {!isAllEnabled && searchQuery.trim().length > 0 && (
                            <div className={cn(
                                "mt-2 border rounded-xl overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-150",
                                theme === 'light' ? "bg-white border-gray-200" : "bg-black/40 border-white/10"
                            )}>
                                {isSearching ? (
                                    <div className="flex items-center justify-center p-4">
                                        <Loader2 className="w-5 h-5 animate-spin text-brand-green" />
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="divide-y divide-border/20">
                                        {searchResults.map(user => {
                                            const allowed = isUserAllowed(user.id, user.can_view_requests);
                                            const isGranting = isGrantingId === user.id;

                                            return (
                                                <div
                                                    key={user.id}
                                                    onClick={() => !allowed && user.role !== 'admin' && !isGranting && handleGrantPermission(user)}
                                                    className={cn(
                                                        "w-full text-right p-3 transition-colors flex items-center justify-between",
                                                        allowed || user.role === 'admin'
                                                            ? "bg-brand-green/5 opacity-80 cursor-default"
                                                            : "hover:bg-brand-green/10 cursor-pointer"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", theme === 'light' ? "bg-gray-100" : "bg-white/5")}>
                                                            <User className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm leading-none">{user.full_name}</div>
                                                            <div className="text-xs text-muted-foreground mt-1 font-mono">{user.job_number}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-semibold">
                                                        {isGranting ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-brand-green inline" />
                                                        ) : user.role === 'admin' ? (
                                                            <span className="text-blue-500">مشرف (متاح)</span>
                                                        ) : allowed ? (
                                                            <span className="text-brand-green flex items-center gap-1">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                مضاف مسبقاً
                                                            </span>
                                                        ) : (
                                                            <span className="text-brand-green hover:underline">إضافة +</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        لا توجد نتائج مطابقة
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Allowed Users List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className={cn("text-sm font-bold block transition-colors", isAllEnabled && "text-muted-foreground")}>
                                {isAllEnabled 
                                    ? `جميع موظفي ${currentGovName} مشمولون بالصلاحية (${totalEmployeesInGov} موظفاً)`
                                    : `الأسماء التي يسمح بظهور التبويبة لديهم (${allowedUsers.length})`
                                }
                            </label>
                            {!isAllEnabled && allowedUsers.length > 5 && (
                                <div className="relative w-48">
                                    <Input
                                        value={filterQuery}
                                        onChange={(e) => setFilterQuery(e.target.value)}
                                        placeholder="تصفية في القائمة..."
                                        className="h-7 text-xs px-2 py-0"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Banner when All Enabled */}
                        {isAllEnabled && (
                            <div className="p-3 rounded-xl bg-brand-green/10 border border-brand-green/30 text-brand-green text-xs font-bold flex items-center gap-2">
                                <Shield className="w-4 h-4 shrink-0" />
                                <span>
                                    تبويبة "الطلبات" مفعلة حالياً لجميع الموظفين في {currentGovName} بنسبة 100%. تم تعطيل القائمة الفردية تلقائياً.
                                </span>
                            </div>
                        )}

                        <div className={cn(
                            "rounded-xl border min-h-[150px] max-h-[300px] overflow-y-auto custom-scrollbar p-2 transition-all duration-300",
                            theme === 'light' ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5",
                            isAllEnabled && "opacity-40 grayscale pointer-events-none select-none"
                        )}>
                            {isLoadingUsers ? (
                                <div className="flex items-center justify-center h-32">
                                    <Loader2 className="w-6 h-6 animate-spin text-brand-green" />
                                </div>
                            ) : filteredAllowedUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground space-y-2">
                                    <ClipboardCheck className="w-8 h-8 opacity-20" />
                                    <span className="text-sm">
                                        {allowedUsers.length === 0 ? 'لم يتم إضافة أي مستخدمين للحاوية بعد' : 'لا توجد نتائج تطابق التصفية'}
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredAllowedUsers.map(user => (
                                        <div
                                            key={user.id}
                                            className={cn(
                                                "flex flex-wrap sm:flex-nowrap items-center justify-between p-3 rounded-lg border gap-3 transition-all",
                                                theme === 'light' ? "bg-white border-gray-200 shadow-sm" : "bg-zinc-800/50 border-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="bg-brand-green/20 text-brand-green p-2 rounded-lg shrink-0">
                                                    <Shield className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm truncate">{user.full_name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{user.job_number}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRevokePermission(user.id, user.full_name)}
                                                className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20 px-2 py-1 h-auto"
                                                title="إزالة وإلغاء صلاحية الظهور"
                                                disabled={isAllEnabled}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Custom Confirmation Modal */}
                {showConfirmModal && (
                    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
                        <div className={cn(
                            "w-full max-w-md rounded-2xl shadow-2xl p-6 border space-y-4 animate-in zoom-in-95 duration-200",
                            theme === 'light' ? "bg-white border-gray-200 text-gray-900" : "bg-zinc-900 border-white/15 text-white"
                        )}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-3 rounded-xl",
                                    confirmAction === 'enable' 
                                        ? "bg-brand-green/15 text-brand-green" 
                                        : "bg-amber-500/15 text-amber-500"
                                )}>
                                    {confirmAction === 'enable' ? (
                                        <CheckCircle2 className="w-6 h-6" />
                                    ) : (
                                        <AlertTriangle className="w-6 h-6" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">
                                        {confirmAction === 'enable' ? 'تأكيد التفعيل الشامل' : 'تأكيد إلغاء التفعيل الشامل'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-mono">
                                        {currentGovName}
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm leading-relaxed">
                                {confirmAction === 'enable' ? (
                                    <>
                                        هل أنت متأكد من التفعيل لجميع الموظفين في <span className="font-bold text-brand-green">{currentGovName}</span>؟
                                        <br />
                                        <span className="text-xs text-muted-foreground mt-1 block">
                                            سيتم منح الصلاحية لـ <strong>{totalEmployeesInGov}</strong> موظفاً فوراً بتشغيل تبويبة الطلبات بنسبة 100%.
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        هل أنت متأكد من إلغاء التفعيل الشامل لجميع الموظفين في <span className="font-bold text-amber-500">{currentGovName}</span> والعودة للتخصيص اليدوي؟
                                    </>
                                )}
                            </p>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowConfirmModal(false)}
                                    disabled={isTogglingAll}
                                    className="px-4 text-sm"
                                >
                                    تراجع
                                </Button>
                                <Button
                                    onClick={executeToggleAll}
                                    disabled={isTogglingAll}
                                    className={cn(
                                        "px-5 text-sm font-bold text-white shadow-md flex items-center gap-2",
                                        confirmAction === 'enable' 
                                            ? "bg-brand-green hover:bg-brand-green/90" 
                                            : "bg-amber-600 hover:bg-amber-700"
                                    )}
                                >
                                    {isTogglingAll && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {confirmAction === 'enable' ? 'نعم، تفعيل للجميع' : 'نعم، إلغاء التفعيل'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
