import { useState, useEffect, useRef } from "react";
import { Search, Save, Undo2, Shield, ChevronDown, Building2, UserCheck, Hash, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "react-hot-toast";
import { cn } from "../../lib/utils";
import { getRoleLabel, roleLabelToDb, ROLE_OPTIONS } from "../../utils/formatRoles";

interface SupervisorPermissionsProps {
    theme: 'light' | 'dark';
}

export const SupervisorPermissions = ({ theme }: SupervisorPermissionsProps) => {
    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Selected employee state
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [departmentName, setDepartmentName] = useState("غير محدد");
    const [managerName, setManagerName] = useState("غير محدد");
    const [selectedRoleLabel, setSelectedRoleLabel] = useState("موظف");
    const [showDropdown, setShowDropdown] = useState(false);
    const [saving, setSaving] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // DEVELOPER_JOB_NUMBER to exclude from search
    const DEVELOPER_JOB_NUMBER = "103130486";

    // Click outside to close suggestions & dropdown
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Debounced search
    useEffect(() => {
        const delay = setTimeout(async () => {
            const q = searchQuery.trim();
            if (!q) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, job_number, role, admin_role, department_id')
                    .or(`job_number.ilike.${q}%,full_name.ilike.${q}%,full_name.ilike.% ${q}%`)
                    .neq('job_number', DEVELOPER_JOB_NUMBER)
                    .limit(50);

                if (error) {
                    console.error("Search error:", error);
                    setSuggestions([]);
                    setShowSuggestions(false);
                } else {
                    // Extra filter to exclude developer by name in case job_number is null
                    const filtered = (data || []).filter(
                        (u: any) => !u.full_name?.includes('مسلم عقيل') && !u.full_name?.includes('مسلم قيل')
                    );
                    setSuggestions(filtered);
                    setShowSuggestions(filtered.length > 0);
                }
            } catch (err) {
                console.error("Search error:", err);
            }
        }, 300);

        return () => clearTimeout(delay);
    }, [searchQuery]);

    // Load employee details (department, manager)
    const loadEmployeeDetails = async (employee: any) => {
        setSelectedEmployee(employee);
        setSearchQuery("");
        setShowSuggestions(false);

        // Set current role label
        setSelectedRoleLabel(getRoleLabel(employee));

        // Fetch department info
        if (employee.department_id) {
            try {
                const { data: depts } = await supabase.from('departments').select('*');
                if (depts) {
                    let currentDept = depts.find((d: any) => d.id === employee.department_id);
                    setDepartmentName(currentDept?.name || 'غير محدد');

                    // Find nearest manager
                    let nearestManagerId: string | null = null;
                    let walkDept = currentDept;
                    while (walkDept) {
                        if (walkDept.manager_id) {
                            nearestManagerId = walkDept.manager_id;
                            break;
                        }
                        walkDept = depts.find((d: any) => d.id === walkDept.parent_id);
                    }

                    if (nearestManagerId) {
                        // If the employee IS the manager, check parent
                        if (nearestManagerId === employee.id && walkDept?.parent_id) {
                            const parentNode = depts.find((d: any) => d.id === walkDept.parent_id);
                            if (parentNode?.manager_id) {
                                nearestManagerId = parentNode.manager_id;
                            }
                        }

                        if (nearestManagerId === employee.id) {
                            setManagerName('مدير المديرية');
                        } else {
                            const { data: mgrProfile } = await supabase
                                .from('profiles')
                                .select('full_name')
                                .eq('id', nearestManagerId)
                                .single();
                            setManagerName(mgrProfile?.full_name || 'غير محدد');
                        }
                    } else {
                        setManagerName('مدير المديرية');
                    }
                }
            } catch (err) {
                console.error("Error loading department info:", err);
                setDepartmentName('غير محدد');
                setManagerName('غير محدد');
            }
        } else {
            setDepartmentName('غير محدد');
            setManagerName('غير محدد');
        }
    };

    // Clear all fields
    const clearFields = () => {
        setSelectedEmployee(null);
        setSearchQuery("");
        setDepartmentName("غير محدد");
        setManagerName("غير محدد");
        setSelectedRoleLabel("موظف");
        setShowDropdown(false);
    };

    // Save to DB
    const handleSave = async () => {
        if (!selectedEmployee) return;

        setSaving(true);
        try {
            const { role, admin_role } = roleLabelToDb(selectedRoleLabel);

            const { error } = await supabase
                .from('profiles')
                .update({ role, admin_role })
                .eq('id', selectedEmployee.id);

            if (error) throw error;

            toast.success(`تم تحديث صلاحية "${selectedEmployee.full_name}" إلى "${selectedRoleLabel}" بنجاح`);
            clearFields();
        } catch (err: any) {
            console.error("Save error:", err);
            toast.error("فشل في حفظ الصلاحية: " + (err.message || "خطأ غير معروف"));
        } finally {
            setSaving(false);
        }
    };

    const isLight = theme === 'light';

    return (
        <div className="p-4 space-y-5">
            {/* Search Field */}
            <div className="relative" ref={searchRef}>
                <div className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-3 transition-all",
                    isLight
                        ? "bg-white border-amber-200 focus-within:ring-2 focus-within:ring-amber-400/30 focus-within:border-amber-400"
                        : "bg-white/5 border-white/10 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500/30"
                )}>
                    <Search className={cn("w-5 h-5 shrink-0", isLight ? "text-amber-500" : "text-amber-400/60")} />
                    <input
                        type="text"
                        placeholder="ابحث عن موظف بالاسم أو الرقم الوظيفي..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                        className={cn(
                            "w-full bg-transparent border-none outline-none text-sm font-bold placeholder:font-normal",
                            isLight ? "text-gray-900 placeholder:text-gray-400" : "text-white placeholder:text-white/30"
                        )}
                    />
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className={cn(
                        "absolute z-50 top-full mt-2 w-full rounded-xl border shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200",
                        isLight ? "bg-white/95 border-amber-200/60" : "bg-slate-900/95 border-white/5"
                    )}>
                        <div className="max-h-[280px] overflow-y-auto scrollbar-hide py-1">
                            {suggestions.map((sug: any) => (
                                <button
                                    key={sug.id}
                                    onMouseDown={() => loadEmployeeDetails(sug)}
                                    className={cn(
                                        "w-full text-right px-4 py-3 flex items-center justify-between transition-colors",
                                        isLight ? "hover:bg-amber-50" : "hover:bg-white/5"
                                    )}
                                >
                                    <div>
                                        <div className={cn("font-bold text-sm", isLight ? "text-gray-900" : "text-white")}>
                                            {sug.full_name}
                                        </div>
                                        <div className={cn("text-xs flex items-center gap-2", isLight ? "text-gray-500" : "text-white/40")}>
                                            <span>{sug.job_number}</span>
                                            <span className="opacity-50">•</span>
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                                sug.role === 'admin'
                                                    ? isLight ? "bg-amber-100 text-amber-700" : "bg-amber-500/20 text-amber-300"
                                                    : isLight ? "bg-gray-100 text-gray-500" : "bg-white/5 text-white/30"
                                            )}>
                                                {getRoleLabel(sug)}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Employee Info Card */}
            {selectedEmployee && (
                <div className={cn(
                    "rounded-xl border p-5 space-y-4 animate-in fade-in slide-in-from-top-3 duration-300",
                    isLight ? "bg-white border-amber-200/60 shadow-sm" : "bg-white/5 border-white/10"
                )}>
                    {/* Employee Name */}
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            isLight ? "bg-amber-100 text-amber-600" : "bg-amber-500/20 text-amber-400"
                        )}>
                            <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className={cn("font-bold text-base", isLight ? "text-gray-900" : "text-white")}>
                                {selectedEmployee.full_name}
                            </h3>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="space-y-3">
                        {/* Job Number */}
                        <div className={cn(
                            "flex items-center gap-3 rounded-lg px-4 py-3 border",
                            isLight ? "bg-gray-50 border-gray-100" : "bg-white/5 border-white/5"
                        )}>
                            <Hash className={cn("w-4 h-4 shrink-0", isLight ? "text-gray-400" : "text-white/30")} />
                            <div className="flex-1">
                                <p className={cn("text-[10px] font-bold", isLight ? "text-gray-400" : "text-white/30")}>الرقم الوظيفي</p>
                                <p className={cn("text-sm font-bold font-mono tracking-wider", isLight ? "text-gray-900" : "text-white")}>
                                    {selectedEmployee.job_number || 'غير محدد'}
                                </p>
                            </div>
                        </div>

                        {/* Workplace */}
                        <div className={cn(
                            "flex items-center gap-3 rounded-lg px-4 py-3 border",
                            isLight ? "bg-gray-50 border-gray-100" : "bg-white/5 border-white/5"
                        )}>
                            <Building2 className={cn("w-4 h-4 shrink-0", isLight ? "text-gray-400" : "text-white/30")} />
                            <div className="flex-1">
                                <p className={cn("text-[10px] font-bold", isLight ? "text-gray-400" : "text-white/30")}>مكان العمل</p>
                                <p className={cn("text-sm font-bold", isLight ? "text-gray-900" : "text-white")}>
                                    {departmentName}
                                </p>
                            </div>
                        </div>

                        {/* Manager */}
                        <div className={cn(
                            "flex items-center gap-3 rounded-lg px-4 py-3 border",
                            isLight ? "bg-gray-50 border-gray-100" : "bg-white/5 border-white/5"
                        )}>
                            <UserCheck className={cn("w-4 h-4 shrink-0", isLight ? "text-gray-400" : "text-white/30")} />
                            <div className="flex-1">
                                <p className={cn("text-[10px] font-bold", isLight ? "text-gray-400" : "text-white/30")}>المسؤول المباشر</p>
                                <p className={cn("text-sm font-bold", isLight ? "text-gray-900" : "text-white")}>
                                    {managerName}
                                </p>
                            </div>
                        </div>

                        {/* Permission Level Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <div className={cn(
                                "flex items-center gap-3 rounded-lg px-4 py-3 border cursor-pointer transition-all",
                                isLight
                                    ? "bg-amber-50 border-amber-200 hover:border-amber-400"
                                    : "bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40"
                            )}
                                onClick={() => setShowDropdown(!showDropdown)}
                            >
                                <Shield className={cn("w-4 h-4 shrink-0", isLight ? "text-amber-600" : "text-amber-400")} />
                                <div className="flex-1">
                                    <p className={cn("text-[10px] font-bold", isLight ? "text-amber-600/60" : "text-amber-400/50")}>مستوى صلاحية الاشراف</p>
                                    <p className={cn("text-sm font-bold", isLight ? "text-amber-800" : "text-amber-300")}>
                                        {selectedRoleLabel}
                                    </p>
                                </div>
                                <ChevronDown className={cn(
                                    "w-4 h-4 transition-transform duration-200",
                                    showDropdown && "rotate-180",
                                    isLight ? "text-amber-500" : "text-amber-400/60"
                                )} />
                            </div>

                            {/* Dropdown Options - Opens upward to avoid accordion overflow clipping */}
                            {showDropdown && (
                                <div className={cn(
                                    "absolute z-40 bottom-full mb-1 w-full rounded-xl border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150",
                                    isLight
                                        ? "bg-white border-amber-200/60"
                                        : "bg-slate-900 border-white/10"
                                )}>
                                    {ROLE_OPTIONS.map((option) => (
                                        <button
                                            key={option}
                                            onClick={() => {
                                                setSelectedRoleLabel(option);
                                                setShowDropdown(false);
                                            }}
                                            className={cn(
                                                "w-full text-right px-4 py-3 text-sm font-bold transition-colors flex items-center justify-between",
                                                selectedRoleLabel === option
                                                    ? isLight
                                                        ? "bg-amber-100 text-amber-800"
                                                        : "bg-amber-500/20 text-amber-300"
                                                    : isLight
                                                        ? "hover:bg-gray-50 text-gray-700"
                                                        : "hover:bg-white/5 text-white/70"
                                            )}
                                        >
                                            <span>{option}</span>
                                            {selectedRoleLabel === option && (
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    isLight ? "bg-amber-500" : "bg-amber-400"
                                                )} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98]",
                                "bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40",
                                saving && "opacity-60 cursor-not-allowed"
                            )}
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            <span>حفظ</span>
                        </button>
                        <button
                            onClick={clearFields}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] border",
                                isLight
                                    ? "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                                    : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                            )}
                        >
                            <Undo2 className="w-4 h-4" />
                            <span>تراجع</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Placeholder when no employee is selected */}
            {!selectedEmployee && (
                <div className={cn(
                    "rounded-xl border p-8 text-center",
                    isLight ? "bg-amber-50/50 border-amber-200/40" : "bg-amber-950/20 border-amber-500/10"
                )}>
                    <Search className={cn("w-10 h-10 mx-auto mb-3", isLight ? "text-amber-500/30" : "text-amber-500/20")} />
                    <h3 className={cn("font-bold text-sm mb-1", isLight ? "text-amber-800" : "text-amber-300")}>
                        ابحث عن موظف لتعديل صلاحياته
                    </h3>
                    <p className={cn("text-xs", isLight ? "text-amber-700/50" : "text-amber-400/30")}>
                        استخدم حقل البحث أعلاه للعثور على الموظف المطلوب
                    </p>
                </div>
            )}
        </div>
    );
};
