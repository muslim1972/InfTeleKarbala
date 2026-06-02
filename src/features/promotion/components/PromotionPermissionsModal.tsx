import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Trash2, Shield, User, GraduationCap } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';

interface PromotionPermissionsModalProps {
    onClose: () => void;
    theme: string;
    mode?: 'supervisors' | 'students';
}

/**
 * مودال تحديد مستخدمي دورات الترفيع
 * للمشرف العام: تحديد المشرفين
 * لمشرف الدورة: تحديد الطلاب
 */
export const PromotionPermissionsModal: React.FC<PromotionPermissionsModalProps> = ({ onClose, theme, mode = 'students' }) => {
    const isSupervisorMode = mode === 'supervisors';
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    const [allowedUsers, setAllowedUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);

    useEffect(() => {
        const trimmed = searchQuery.trim();
        if (!trimmed) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const { data, error } = await supabase.rpc('search_promotion_candidates', {
                    search_term: trimmed
                });
                if (error) throw error;
                setSearchResults(data || []);
            } catch (err) {
                console.error('Search error:', err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchAllowedUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const { data, error } = await supabase.rpc('get_promotion_users', {
                supervisor_mode: isSupervisorMode
            });

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
        fetchAllowedUsers();
    }, [mode]);

    const handleGrantPermission = async (user: any) => {
        if (isSupervisorMode && user.is_promotion_lecturer) {
            toast.error('هذا المستخدم مشرف مسبقاً.');
            return;
        }
        if (!isSupervisorMode && user.can_access_promotion && !user.is_promotion_lecturer) {
            toast.error('هذا المستخدم طالب مسبقاً.');
            return;
        }

        try {
            const { error } = await supabase.rpc('set_promotion_permission', {
                target_user_id: user.id,
                make_supervisor: isSupervisorMode,
                make_student: true
            });

            if (error) throw error;

            toast.success(`تم منح صلاحية (${isSupervisorMode ? 'مشرف' : 'طالب'}) لـ ${user.full_name}`);
            setSearchQuery('');
            fetchAllowedUsers();
        } catch (error: any) {
            console.error('Error updating permission:', error);
            toast.error('فشل في منح الصلاحية');
        }
    };

    const handleRevokePermission = async (userId: string, userName: string) => {
        const confirmResult = window.confirm(`هل أنت متأكد من إزالة الصلاحية لـ ${userName}؟`);
        if (!confirmResult) return;

        try {
            const { error } = await supabase.rpc('set_promotion_permission', {
                target_user_id: userId,
                make_supervisor: false,
                make_student: false
            });

            if (error) throw error;

            toast.success(`تم إزالة الصلاحية لـ ${userName}`);
            fetchAllowedUsers();
        } catch (error: any) {
            console.error('Error updating permission:', error);
            toast.error('فشل في إزالة الصلاحية');
        }
    };

    const title = isSupervisorMode ? "تحديد المشرفين على دورة الترفيع" : "تحديد الطلبة المشاركين";
    const description = isSupervisorMode 
        ? "تحديد الموظفين كمشرفين على دورات الترفيع وإدارة الاختبارات." 
        : "إضافة وتعديل أدوار الطلاب المشاركين في دورات الترفيع.";

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={cn(
                "relative w-full max-w-2xl rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                theme === 'light' ? 'bg-white text-gray-900 border border-gray-200' : 'bg-zinc-900 text-white border border-white/10'
            )}>
                <button onClick={onClose} className="absolute left-6 top-6 p-2 rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/10">
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                        {isSupervisorMode ? <Shield className="w-6 h-6" /> : <GraduationCap className="w-6 h-6" />}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{title}</h2>
                        <p className={cn("text-sm", theme === 'light' ? "text-gray-500" : "text-white/50")}>
                            {description}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    {/* Search Field */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold block">إضافة موظف</label>
                        <div className="relative">
                            <Search className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4", theme === 'light' ? "text-gray-400" : "text-white/40")} />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                                className="pl-10 pr-10"
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {searchQuery.trim().length > 0 && (
                            <div className={cn(
                                "mt-2 border rounded-xl overflow-hidden shadow-lg",
                                theme === 'light' ? "bg-white border-gray-200" : "bg-black/40 border-white/10"
                            )}>
                                {isSearching ? (
                                    <div className="flex items-center justify-center p-4">
                                        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="divide-y divide-border/20">
                                        {searchResults.map(user => {
                                            const isAlreadyAdded = isSupervisorMode 
                                                ? user.is_promotion_lecturer 
                                                : (user.can_access_promotion && !user.is_promotion_lecturer);

                                            return (
                                                <div
                                                    key={user.id}
                                                    className="w-full text-right p-3 hover:bg-amber-500/5 transition-colors flex items-center justify-between gap-3 border-b border-border/10 last:border-b-0"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", theme === 'light' ? "bg-gray-100" : "bg-white/5")}>
                                                            <User className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-sm leading-none truncate">{user.full_name}</div>
                                                            <div className="text-xs text-muted-foreground mt-1 font-mono">{user.job_number}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {isAlreadyAdded ? (
                                                            <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg">مضاف مسبقاً</span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleGrantPermission(user)}
                                                                className={cn(
                                                                    "px-2 py-1.5 text-[10px] font-bold rounded-lg text-white transition-colors",
                                                                    isSupervisorMode ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-500 hover:bg-blue-600"
                                                                )}
                                                            >
                                                                {isSupervisorMode ? '+ مشرف' : '+ طالب'}
                                                            </button>
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
                        <label className="text-sm font-bold block">{isSupervisorMode ? 'المشرفون الحاليون' : 'الطلاب المشاركون'}</label>
                        <div className={cn(
                            "rounded-xl border min-h-[150px] max-h-[300px] overflow-y-auto custom-scrollbar p-2",
                            theme === 'light' ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"
                        )}>
                            {isLoadingUsers ? (
                                <div className="flex items-center justify-center h-32">
                                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                                </div>
                            ) : allowedUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground space-y-2">
                                    {isSupervisorMode ? <Shield className="w-8 h-8 opacity-20" /> : <GraduationCap className="w-8 h-8 opacity-20" />}
                                    <span className="text-sm">لم يتم إضافة أي مستخدمين بعد</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {allowedUsers.map(user => (
                                        <div
                                            key={user.id}
                                            className={cn(
                                                "flex flex-wrap sm:flex-nowrap items-center justify-between p-3 rounded-lg border gap-3",
                                                theme === 'light' ? "bg-white border-gray-200" : "bg-zinc-800/50 border-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={cn(
                                                    "p-2 rounded-lg shrink-0",
                                                    isSupervisorMode ? "bg-amber-500/20 text-amber-500" : "bg-blue-500/20 text-blue-500"
                                                )}>
                                                    {isSupervisorMode ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-sm truncate">{user.full_name}</p>
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 text-[9px] font-bold rounded shrink-0 border",
                                                            isSupervisorMode 
                                                                ? "bg-amber-500/20 text-amber-500 dark:text-amber-400 border-amber-500/30"
                                                                : "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30"
                                                        )}>
                                                            {isSupervisorMode ? 'مشرف' : 'طالب'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground font-mono">{user.job_number}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleRevokePermission(user.id, user.full_name)}
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20 px-2 py-1 h-auto"
                                                    title="إزالة وإلغاء صلاحية الوصول"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
