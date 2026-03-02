import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Trash2, Shield, User, ClipboardCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface RequestsTabPermissionsModalProps {
    onClose: () => void;
    theme: string;
}

export const RequestsTabPermissionsModal: React.FC<RequestsTabPermissionsModalProps> = ({ onClose, theme }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [allowedUsers, setAllowedUsers] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);

    // Fetch allowed users on mount
    const fetchAllowedUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, job_number, role')
                .eq('can_view_requests', true)
                .order('full_name');

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
    }, []);

    // Search users
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (!searchQuery.trim()) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                // Focus on normal users only since admins always see it
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, job_number, role, can_view_requests')
                    .or(`full_name.ilike.%${searchQuery}%,job_number.ilike.%${searchQuery}%`)
                    .limit(10);

                if (error) throw error;
                setSearchResults(data || []);
            } catch (error: any) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchQuery]);

    const handleGrantPermission = async (user: any) => {
        if (user.role === 'admin') {
            toast.error('هذا المستخدم "مشرف" ولديه صلاحية رؤية التبويبة مسبقاً.');
            return;
        }
        if (user.can_view_requests) {
            toast.error('هذا المستخدم لديه صلاحية مسبقاً.');
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ can_view_requests: true })
                .eq('id', user.id);

            if (error) throw error;

            toast.success(`تم منح الصلاحية لـ ${user.full_name}`);
            setSearchQuery('');
            setSearchResults([]);
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
            const { error } = await supabase
                .from('profiles')
                .update({ can_view_requests: false })
                .eq('id', userId);

            if (error) throw error;

            toast.success(`تم إزالة الصلاحية والتأشير بـ false لـ ${userName}`);
            fetchAllowedUsers();
        } catch (error: any) {
            console.error('Error updating permission:', error);
            toast.error('فشل في إزالة الصلاحية');
        }
    };

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
                    <div className="p-3 bg-brand-green/10 text-brand-green rounded-xl">
                        <ClipboardCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">تحديد مستخدمي تبويبة الطلبات</h2>
                        <p className={cn("text-sm", theme === 'light' ? "text-gray-500" : "text-white/50")}>
                            السماح لموظفين محددين برؤية تبويبة "الطلبات" (بمستوى صلاحية user).
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    {/* Search Field */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold block">إضافة موظف للحاوية</label>
                        <div className="relative">
                            <Search className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4", theme === 'light' ? "text-gray-400" : "text-white/40")} />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                                className="pl-3 pr-10"
                                autoFocus
                            />
                        </div>

                        {/* Search Results Dropdown-like UI */}
                        {searchQuery.trim().length > 0 && (
                            <div className={cn(
                                "mt-2 border rounded-xl overflow-hidden shadow-lg",
                                theme === 'light' ? "bg-white border-gray-200" : "bg-black/40 border-white/10"
                            )}>
                                {isSearching ? (
                                    <div className="flex items-center justify-center p-4">
                                        <Loader2 className="w-5 h-5 animate-spin text-brand-green" />
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="divide-y divide-border/20">
                                        {searchResults.map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => handleGrantPermission(user)}
                                                className={cn(
                                                    "w-full text-right p-3 hover:bg-brand-green/10 transition-colors flex items-center justify-between",
                                                    (user.can_view_requests || user.role === 'admin') ? "opacity-50 cursor-not-allowed" : ""
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
                                                <div className="text-xs">
                                                    {user.role === 'admin' ? 'مشرف (متاح)' : user.can_view_requests ? 'مضاف مسبقاً' : 'إضافة +'}
                                                </div>
                                            </button>
                                        ))}
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
                        <label className="text-sm font-bold block">الأسماء التي يسمح بظهور التبويبة لديهم</label>
                        <div className={cn(
                            "rounded-xl border min-h-[150px] max-h-[300px] overflow-y-auto custom-scrollbar p-2",
                            theme === 'light' ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"
                        )}>
                            {isLoadingUsers ? (
                                <div className="flex items-center justify-center h-32">
                                    <Loader2 className="w-6 h-6 animate-spin text-brand-green" />
                                </div>
                            ) : allowedUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground space-y-2">
                                    <ClipboardCheck className="w-8 h-8 opacity-20" />
                                    <span className="text-sm">لم يتم إضافة أي مستخدمين للحاوية بعد</span>
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
            </div>
        </div>
    );
};
