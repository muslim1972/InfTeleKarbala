import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Loader2, Search, X, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { createPortal } from 'react-dom';
import { HistoryViewer } from './HistoryViewer';
import { useAuth } from '../../context/AuthContext';
import { useEmployeeSearch } from '../../hooks/useEmployeeSearch';

interface FixLeaveBalanceModalProps {
    onClose: () => void;
}

export function FixLeaveBalanceModal({ onClose }: FixLeaveBalanceModalProps) {
    const { theme } = useTheme();
    const { user: currentUser } = useAuth();
    // البحث العالمي للموظفين
    const { query: searchQuery, setQuery: setSearchQuery, results: suggestions, isSearching } = useEmployeeSearch({
        limit: 5,
        debounceMs: 300
    });
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [financialRecord, setFinancialRecord] = useState<any>(null);
    const [newBalance, setNewBalance] = useState<number | ''>('');
    const [isSaving, setIsSaving] = useState(false);
    const [_loadingRecord, setLoadingRecord] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Show suggestions when results change
    useEffect(() => {
        setShowSuggestions(suggestions.length > 0 && searchQuery.trim().length > 0);
    }, [suggestions, searchQuery]);

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectSuggestion = async (employee: any) => {
        setSelectedEmployee(employee);
        setShowSuggestions(false);
        setSearchQuery(""); // Clear search

        // Fetch financial record to get current balance
        setLoadingRecord(true);
        try {
            const { data, error } = await supabase
                .from('financial_records')
                .select('*')
                .eq('user_id', employee.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // Ignore not found

            setFinancialRecord(data || null);
            setNewBalance(data?.remaining_leaves_balance ?? 0);
        } catch (err) {
            console.error("Fetch financial record error:", err);
            toast.error("حدث خطأ أثناء جلب الرصيد المالي للموظف.");
        } finally {
            setLoadingRecord(false);
        }
    };

    const handleSave = async () => {
        if (!selectedEmployee) return;
        if (newBalance === '' || isNaN(Number(newBalance))) {
            toast.error("يرجى إدخال رقم صحيح للرصيد.");
            return;
        }

        // Double Confirmation
        const confirmed = window.confirm(`⚠️ تحذير: أنت على وشك تغيير رصيد الإجازات للموظف ${selectedEmployee.full_name} إلى ${newBalance} يوم. هل أنت متأكد من هذا الإجراء التعسفي؟`);
        if (!confirmed) return;

        setIsSaving(true);
        try {
            if (financialRecord?.id) {
                // Update existing record
                const { error } = await supabase
                    .from('financial_records')
                    .update({ remaining_leaves_balance: Number(newBalance) })
                    .eq('id', financialRecord.id);
                if (error) throw error;

                // Track history
                if (financialRecord?.remaining_leaves_balance != newBalance) {
                    await supabase.from('field_change_logs').insert([{
                        table_name: 'financial_records',
                        record_id: financialRecord.id,
                        field_name: 'remaining_leaves_balance',
                        old_value: String(financialRecord?.remaining_leaves_balance ?? 0),
                        new_value: String(newBalance),
                        changed_by: currentUser?.id,
                        changed_by_name: currentUser?.full_name || 'مسؤول النظام'
                    }]);
                }
            } else {
                // Create new basic record if one somehow doesn't exist
                const { error, data } = await supabase
                    .from('financial_records')
                    .insert([{
                        user_id: selectedEmployee.id,
                        nominal_salary: 0,
                        remaining_leaves_balance: Number(newBalance)
                    }])
                    .select();

                if (error) throw error;

                // Track history for new record
                if (data && data.length > 0) {
                    await supabase.from('field_change_logs').insert([{
                        table_name: 'financial_records',
                        record_id: data[0].id,
                        field_name: 'remaining_leaves_balance',
                        old_value: '0',
                        new_value: String(newBalance),
                        changed_by: currentUser?.id,
                        changed_by_name: currentUser?.full_name || 'مسؤول النظام'
                    }]);
                }
            }

            toast.success("تم تحديث الرصيد وحفظه في قاعدة البيانات بنجاح!");
            onClose(); // Optional: close modal or just reset state to edit someone else
        } catch (err: any) {
            console.error("Save error:", err);
            toast.error("فشل حفظ الرصيد: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`w-full max-w-md rounded-2xl shadow-2xl border flex flex-col ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
                }`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b rounded-t-2xl ${theme === 'light' ? 'border-zinc-100 bg-zinc-50' : 'border-zinc-800 bg-zinc-950/50'
                    }`}>
                    <div className="flex items-center gap-2 text-rose-600">
                        <ShieldAlert className="w-5 h-5" />
                        <h3 className="font-bold text-lg">أداة إصلاح الرصيد</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-zinc-500/10 text-zinc-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-6">
                    {/* Search Field */}
                    <div className="relative z-50">
                        <label className={`block text-xs font-bold mb-2 ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                            البحث عن الموظف
                        </label>
                        <div className="relative" ref={searchRef}>
                            <input
                                autoFocus
                                type="text"
                                placeholder="الرقم الوظيفي أو اسم الموظف..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full text-sm pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${theme === 'light'
                                    ? 'bg-zinc-50 border-zinc-200 focus:border-rose-400 focus:ring-rose-400/20 text-zinc-900'
                                    : 'bg-zinc-950 border-zinc-800 focus:border-rose-500/50 focus:ring-rose-500/20 text-white placeholder-zinc-600'
                                    }`}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                {isSearching ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                                ) : (
                                    <Search className="w-5 h-5 text-zinc-400" />
                                )}
                            </div>

                            {/* Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className={`absolute top-full mt-2 left-0 right-0 rounded-xl border shadow-xl overflow-hidden max-h-[220px] overflow-y-auto ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
                                    }`}>
                                    {suggestions.map((user, idx) => (
                                        <button
                                            key={user.id || idx}
                                            onClick={() => handleSelectSuggestion(user)}
                                            className={`w-full text-right px-4 py-3 border-b flex items-center justify-between group transition-colors cursor-pointer ${theme === 'light'
                                                ? 'hover:bg-zinc-50/80 border-zinc-100 last:border-0'
                                                : 'hover:bg-zinc-800/80 border-zinc-800/50 last:border-0'
                                                }`}
                                        >
                                            <div>
                                                <div className={`font-bold group-hover:text-rose-500 transition-colors ${theme === 'light' ? 'text-zinc-900' : 'text-white'
                                                    }`}>
                                                    {user.full_name}
                                                </div>
                                                <div className={`text-xs mt-1 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                                    الرقم الوظيفي: {user.job_number}
                                                </div>
                                            </div>
                                            <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-1 rounded text-xs font-bold">
                                                تحديد
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Editor Form */}
                    {selectedEmployee && (
                        <div className={`p-4 rounded-xl border animate-in fade-in slide-in-from-top-4 duration-300 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-zinc-800'
                            }`}>
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                                <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-lg">
                                    {selectedEmployee.full_name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className={`font-bold ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
                                        {selectedEmployee.full_name}
                                    </h4>
                                    <p className={`text-xs ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                        {selectedEmployee.job_number}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className={`block text-xs font-bold ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                            رصيد الإجازات الاعتيادية الفعلي
                                        </label>
                                        {financialRecord?.id && (
                                            <HistoryViewer
                                                tableName="financial_records"
                                                recordId={financialRecord.id}
                                                fieldName="remaining_leaves_balance"
                                                label="رصيد الإجازات"
                                            />
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        dir="ltr"
                                        value={newBalance}
                                        onChange={(e) => setNewBalance(e.target.value ? Number(e.target.value) : '')}
                                        className={`w-full text-center text-xl font-bold font-mono px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${theme === 'light'
                                            ? 'bg-white border-zinc-200 focus:border-rose-400 focus:ring-rose-400/20 text-zinc-900'
                                            : 'bg-zinc-900 border-zinc-800 focus:border-rose-500/50 focus:ring-rose-500/20 text-white'
                                            }`}
                                    />
                                    <p className="text-[10px] text-rose-500 mt-2 flex items-center gap-1 font-bold">
                                        <AlertCircle className="w-3 h-3" />
                                        هذا الرقم سيستبدل الرصيد الحالي بشكل مباشر. استعمله بحذر!
                                    </p>
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || newBalance === ''}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5" />
                                    )}
                                    اعتماد وتغيير الرصيد
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

// Ensure AlertCircle is imported, actually we can use ShieldAlert instead so we don't have unused or undeclared imports. Quick fix: add AlertCircle to lucide imports.
