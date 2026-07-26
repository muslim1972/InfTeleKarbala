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
    type?: 'regular' | 'sick';
}

export function FixLeaveBalanceModal({ onClose, type = 'regular' }: FixLeaveBalanceModalProps) {
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

    const balanceField = type === 'sick' ? 'sick_leaves_balance' : 'remaining_leaves_balance';
    const balanceTitle = type === 'sick' ? 'الرصيد المرضي' : 'رصيد الإجازات الاعتيادية';

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
            setNewBalance(data ? data[balanceField] : 0);
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
        const confirmed = window.confirm(`⚠️ تحذير: أنت على وشك تغيير ${balanceTitle} للموظف ${selectedEmployee.full_name} إلى ${newBalance} يوم. هل أنت متأكد من هذا الإجراء التعسفي؟`);
        if (!confirmed) return;

        setIsSaving(true);
        try {
            if (financialRecord?.id) {
                // Update existing record
                const { error } = await supabase
                    .from('financial_records')
                    .update({ [balanceField]: Number(newBalance) })
                    .eq('id', financialRecord.id);
                if (error) throw error;

                // Track history
                if (financialRecord?.[balanceField] != newBalance) {
                    await supabase.from('field_change_logs').insert([{
                        table_name: 'financial_records',
                        record_id: financialRecord.id,
                        field_name: balanceField,
                        old_value: String(financialRecord?.[balanceField] ?? 0),
                        new_value: String(newBalance),
                        changed_by: currentUser?.id,
                        change_reason: `تعديل استثنائي من لوحة المشرفين (${balanceTitle})`
                    }]);
                }
            } else {
                // Insert new record if doesn't exist
                const { error } = await supabase
                    .from('financial_records')
                    .insert([{ 
                        user_id: selectedEmployee.id, 
                        [balanceField]: Number(newBalance),
                        nominal_salary: 0 
                    }]);
                if (error) throw error;

                // Track history
                const { data: newRecord } = await supabase.from('financial_records').select('id').eq('user_id', selectedEmployee.id).single();
                if (newRecord) {
                    await supabase.from('field_change_logs').insert([{
                        table_name: 'financial_records',
                        record_id: newRecord.id,
                        field_name: balanceField,
                        old_value: '0',
                        new_value: String(newBalance),
                        changed_by: currentUser?.id,
                        change_reason: `إنشاء وتعديل استثنائي من لوحة المشرفين (${balanceTitle})`
                    }]);
                }
            }

            toast.success(`تم تحديث ${balanceTitle} بنجاح.`);
            setFinancialRecord((prev: any) => ({ ...prev, [balanceField]: Number(newBalance) }));
            setSelectedEmployee(null); // Reset after save
            setSearchQuery("");
        } catch (err) {
            console.error("Save balance error:", err);
            toast.error("حدث خطأ أثناء حفظ الرصيد الجديد.");
        } finally {
            setIsSaving(false);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className={`p-4 text-white flex justify-between items-center ${type === 'sick' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <ShieldAlert size={20} />
                        أداة إصلاح {balanceTitle}
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1.5 rounded-lg transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                    <div className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex gap-3 text-sm">
                        <AlertCircle className="shrink-0 mt-0.5" size={18} />
                        <p>
                            هذه الأداة مخصصة <strong>للحالات الطارئة فقط</strong>. أي تعديل يتم هنا هو تعديل "قسري" لقاعدة البيانات وسجل التغييرات سيتم الاحتفاظ به وتدقيقه.
                        </p>
                    </div>

                    {!selectedEmployee ? (
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">ابحث عن الموظف لتعديل رصيده</label>
                            <div className="relative" ref={searchRef}>
                                <div className="relative">
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        {isSearching ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" /> : <Search className="w-5 h-5 text-gray-400" />}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="ابحث بالاسم الرباعي..."
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl py-3 pr-10 pl-4 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={() => setShowSuggestions(suggestions.length > 0)}
                                    />
                                </div>
                                {showSuggestions && (
                                    <div className="mt-2 w-full bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-xl shadow-sm max-h-60 overflow-y-auto">
                                        {suggestions.map((emp) => (
                                            <div
                                                key={emp.id}
                                                onClick={() => handleSelectSuggestion(emp)}
                                                className="px-4 py-3 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer border-b last:border-b-0 border-gray-50 dark:border-slate-700/50 transition-colors flex justify-between items-center"
                                            >
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white text-sm">{emp.full_name}</p>
                                                    <p className="text-xs text-gray-500">{emp.department?.name || 'بدون قسم'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl flex justify-between items-center border border-gray-200 dark:border-slate-700">
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">{selectedEmployee.full_name}</p>
                                    <p className="text-sm text-gray-500">{selectedEmployee.job_number || 'بدون رقم وظيفي'}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedEmployee(null)}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-bold"
                                >
                                    تغيير الموظف
                                </button>
                            </div>

                            <div className="space-y-4 bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900 p-5 rounded-2xl shadow-inner">
                                <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="text-gray-500">الرصيد الحالي في النظام:</span>
                                    <span className="font-mono font-bold text-lg text-rose-600 dark:text-rose-400">
                                        {financialRecord ? financialRecord[balanceField] : '0'} يوم
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <ShieldAlert size={16} className="text-rose-500" />
                                        إدخال الرصيد الجديد قسرياً
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="مثال: 57"
                                        value={newBalance}
                                        onChange={(e) => setNewBalance(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full bg-white dark:bg-slate-800 border-2 border-rose-200 dark:border-rose-800 rounded-xl py-3 px-4 text-gray-900 dark:text-white font-mono text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                                        dir="ltr"
                                    />
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || newBalance === '' || Number(newBalance) === financialRecord?.[balanceField]}
                                    className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-500/30"
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                    تأكيد وتحديث الرصيد نهائياً
                                </button>
                            </div>

                            {/* Show Logs */}
                            {financialRecord && (
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                                    <h4 className="font-bold text-sm mb-3">سجل تغييرات هذا الحقل:</h4>
                                    <HistoryViewer
                                        recordId={financialRecord.id}
                                        tableName="financial_records"
                                        fieldName={balanceField}
                                        theme={theme}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
