import { useState } from "react";
import { Search, Loader2, Trash2, Lock, RotateCcw, X } from "lucide-react";
import { useSnapshots } from "../../../context/SnapshotContext";
import { ScrollableTabs } from "../../ui/ScrollableTabs";
import { YearSlider } from "../../features/YearSlider";
import { cn } from "../../../lib/utils";
import { EmployeeSearch } from "../../shared/EmployeeSearch";
import { isDeveloperLevel } from "../../../utils/permissions";

const getThreePartName = (name: string): string => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    return parts.length > 3 ? parts.slice(0, 3).join(' ') : name;
};

interface DashboardHeaderProps {
    activeTab: string;
    setActiveTab: (tab: any) => void;
    currentUser: any;
    isRoleEditable: boolean;
    canAddEmployee: boolean;
    canAccessAttendance?: boolean;
    isFieldReadOnly: (columnName: string) => boolean;
    theme: 'light' | 'dark';
    selectedAdminYear: number;
    setSelectedAdminYear: (year: number) => void;
    selectedEmployee: any;
    handleSaveEmployee: (e: any) => Promise<void>;
    handleUpdateEmployee: () => Promise<void>;
    loading: boolean;
    searchExpanded: boolean;
    setSearchExpanded: (expanded: boolean) => void;
    searchJobNumber: string;
    setSearchJobNumber: (val: string) => void;
    handleSearch: () => void;
    suggestions: any[];
    setShowSuggestions: (show: boolean) => void;
    showSuggestions: boolean;
    searchRef: React.RefObject<HTMLDivElement | null>;
    handleSelectSuggestion: (user: any) => void;
    handleDeleteEmployee?: () => Promise<void>;
}

export const DashboardHeader = ({
    activeTab,
    setActiveTab,
    currentUser,
    isRoleEditable,
    canAddEmployee,
    canAccessAttendance,
    isFieldReadOnly,
    theme,
    selectedAdminYear,
    setSelectedAdminYear,
    selectedEmployee,
    handleSaveEmployee,
    handleUpdateEmployee,
    loading,
    searchExpanded: _searchExpanded,
    setSearchExpanded: _setSearchExpanded,
    searchJobNumber: _searchJobNumber,
    setSearchJobNumber: _setSearchJobNumber,
    handleSearch: _handleSearch,
    suggestions: _suggestions,
    setShowSuggestions: _setShowSuggestions,
    showSuggestions: _showSuggestions,
    searchRef: _searchRef,
    handleSelectSuggestion,
    handleDeleteEmployee
}: DashboardHeaderProps) => {
    const { isHistorical, historicalSnapshot, exitHistoricalView } = useSnapshots();

    const tabs = (() => {
        const isBiometricAdmin = currentUser?.admin_role === 'biometric' || currentUser?.admin_role === 'attendance_supervisor' || currentUser?.username === 'attend';
        const canAccessNews = !isBiometricAdmin && !isFieldReadOnly('tab_news');
        const canManageAttendance = Boolean(
            canAccessAttendance ||
            isRoleEditable ||
            currentUser?.has_attendance_access === true ||
            isBiometricAdmin
        );

        const allTabs = [
            ...(canAddEmployee ? [{ id: 'admin_add', label: 'إضافة موظف' }] : []),
            ...(!isBiometricAdmin ? [{ id: 'admin_manage', label: 'إدارة الموظفين' }] : []),
            ...(!isBiometricAdmin ? [{ id: 'admin_records', label: 'إدارة السجلات' }] : []),
            ...(!isBiometricAdmin ? [{ id: 'admin_incentives', label: 'الحوافز' }] : []),
            { id: 'admin_stats', label: 'الإحصاءات' },
            ...(canAccessNews ? [{ id: 'admin_news', label: 'الاعلام' }] : []),
            ...(!isBiometricAdmin ? [{ id: 'admin_departments', label: 'الهيكلية الإدارية' }] : []),
            { id: 'admin_audio', label: 'القرآن الكريم' },
            ...((isBiometricAdmin || isFieldReadOnly('tab_supervisors')) ? [] : [{ id: 'admin_supervisors', label: 'المشرفون' }]),
            ...((currentUser?.admin_role === 'general' || isDeveloperLevel(currentUser?.admin_role)) ? [{ id: 'admin_promotion', label: 'دورات الترفيع' }] : []),
            ...(canManageAttendance ? [{ id: 'admin_attendance', label: 'إدارة البصمة' }] : [])
        ];

        return allTabs;
    })();

    const [showFloatingSearch, setShowFloatingSearch] = useState(false);
    const hasActionContent = activeTab === 'admin_records' || activeTab === 'admin_add' || (activeTab === 'admin_manage' && selectedEmployee);

    return (
        <div className="space-y-2">
            {/* Tabs */}
            <div className={`flex p-1 rounded-xl border shadow-inner w-full ${theme === 'light'
                ? 'bg-white border-gray-100'
                : 'bg-black/40 border-white/5'
                } backdrop-blur-md overflow-hidden`}>
                <ScrollableTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as any)}
                    containerClassName="w-full"
                    activeTabClassName="bg-blue-600 text-white shadow-lg"
                    inactiveTabClassName={theme === 'light' ? "text-gray-600 hover:text-black" : "text-white/40 hover:text-white/60"}
                />
            </div>

            {/* زر المكبرة العائم الموحد على اليسار لجميع واجهات المشرفين */}
            <div className="fixed top-24 left-3 sm:left-6 z-40">
                <button
                    onClick={() => setShowFloatingSearch(true)}
                    className={cn(
                        "p-2.5 rounded-2xl transition-all duration-300 shadow-lg backdrop-blur-xl border active:scale-95 flex items-center justify-center group",
                        theme === 'light'
                            ? "bg-white/95 border-gray-200/90 text-gray-700 hover:text-brand-green hover:border-brand-green/30 shadow-gray-200/50"
                            : "bg-slate-900/95 border-white/10 text-white/80 hover:text-brand-green hover:border-brand-green/40 shadow-black/50"
                    )}
                    title="البحث عن موظف"
                >
                    <Search className="w-5 h-5 transition-transform group-hover:scale-110" />
                    {selectedEmployee && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-green rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                    )}
                </button>
            </div>

            {/* نافذة البحث العائمة الذكية */}
            {showFloatingSearch && (
                <div 
                    className="fixed inset-0 z-50 flex items-start justify-center pt-24 sm:pt-28 px-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowFloatingSearch(false)}
                >
                    <div 
                        className={cn(
                            "w-full max-w-lg rounded-3xl p-4 sm:p-5 shadow-2xl border space-y-4 animate-in zoom-in-95 duration-200 overflow-visible",
                            theme === 'light'
                                ? "bg-white border-gray-200 shadow-xl"
                                : "bg-slate-900 border-white/10 shadow-2xl"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-brand-green/10 text-brand-green">
                                    <Search className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className={cn("font-bold text-sm sm:text-base", theme === 'light' ? "text-gray-900" : "text-white")}>
                                        البحث السريع عن موظف
                                    </h3>
                                    <p className="text-[11px] text-muted-foreground">
                                        اكتب اسم الموظف أو رقمه الوظيفي للانتقال إلى ملفه مباشرة
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowFloatingSearch(false)}
                                className={cn(
                                    "p-1.5 rounded-xl transition-colors",
                                    theme === 'light' ? "hover:bg-gray-100 text-gray-500" : "hover:bg-white/10 text-white/60"
                                )}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="relative overflow-visible">
                            <EmployeeSearch
                                onSelect={(sug) => {
                                    handleSelectSuggestion(sug);
                                    if (activeTab !== 'admin_manage') {
                                        setActiveTab('admin_manage');
                                    }
                                    setShowFloatingSearch(false);
                                }}
                                placeholder="اكتب اسم الموظف أو رقمه الوظيفي..."
                                autoFocus={true}
                                showIcon={true}
                                inputClassName={cn(
                                    "w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-all",
                                    theme === 'light'
                                        ? "bg-gray-50 border-gray-200 text-black placeholder:text-gray-400"
                                        : "bg-white/5 border-white/10 text-white placeholder:text-white/40"
                                )}
                            />
                        </div>

                        {selectedEmployee && (
                            <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-xs text-muted-foreground">
                                <span>الموظف المحدد حالياً:</span>
                                <span className="font-bold text-brand-green">{selectedEmployee.full_name}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* شريط الإجراءات والسنوات — يظهر فقط عند وجود إجراء فعلي (حفظ أو سنوات أو موظف محدد) */}
            {hasActionContent && (
            <div className="flex items-center justify-between gap-3 relative overflow-visible h-10 min-h-[40px]">

                {/* Right Side (Start in RTL): Year Slider أو زر الحفظ */}
                <div className="flex-shrink-0 min-w-[140px]">
                    {activeTab === 'admin_records' ? (
                        <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-lg border animate-in fade-in zoom-in duration-300",
                            theme === 'light'
                                ? "bg-white border-gray-200 shadow-sm"
                                : "bg-white/5 border-white/5"
                        )}>
                            <div className="w-28">
                                <YearSlider
                                    selectedYear={selectedAdminYear}
                                    onYearChange={setSelectedAdminYear}
                                />
                            </div>
                        </div>
                    ) : (activeTab === 'admin_add' || (activeTab === 'admin_manage' && selectedEmployee)) ? (
                        isHistorical ? (
                            <div className="flex items-center gap-1.5 w-full animate-in fade-in zoom-in duration-300">
                                <div
                                    title={`أنت في وضع استعراض أرشيف «${historicalSnapshot?.name || ''}» (للاطلاع فقط)`}
                                    className="flex-1 py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-sm truncate"
                                >
                                    <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <span className="truncate">
                                        أرشيف «{historicalSnapshot?.name || 'شهر سابق'}»
                                    </span>
                                </div>
                                <button
                                    onClick={exitHistoricalView}
                                    title="العودة إلى بيانات الشهر الحالي المعتمد"
                                    className="shrink-0 py-1.5 px-2.5 rounded-lg font-bold text-[11px] flex items-center gap-1 bg-brand-green hover:bg-brand-green/90 text-white shadow-sm transition-all active:scale-95"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>الحالي</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => activeTab === 'admin_add' ? handleSaveEmployee(e) : handleUpdateEmployee()}
                                disabled={loading || currentUser?.admin_role === 'media'}
                                title={currentUser?.admin_role === 'media' ? "ليس لديك صلاحية الحفظ" : "حفظ التعديلات"}
                                className="w-full py-2 px-2 rounded-lg font-bold text-xs flex items-center justify-center transition-all animate-in fade-in zoom-in duration-300 whitespace-nowrap bg-brand-green hover:bg-brand-green/90 text-white shadow-lg shadow-brand-green/20 disabled:opacity-50"
                            >
                                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-2" />}
                                <span>حفظ التعديل والاضافة</span>
                            </button>
                        )
                    ) : (
                        <div id="admin-header-portal" className="w-full h-full flex items-center" />
                    )}
                </div>

                {/* Left Side (End in RTL): اسم الموظف المحدد وزر الحذف إن وجد */}
                <div className="flex items-center gap-3">
                    {selectedEmployee && (
                        <div
                            title={selectedEmployee.full_name}
                            className={`max-w-[140px] xs:max-w-[180px] sm:max-w-[240px] md:max-w-[320px] overflow-x-auto whitespace-nowrap scrollbar-none font-bold text-xs sm:text-sm animate-in fade-in duration-200 cursor-grab active:cursor-grabbing select-all px-1.5 py-0.5 rounded ${
                                theme === 'light' ? 'text-gray-900' : 'text-white'
                            }`}
                        >
                            {getThreePartName(selectedEmployee.full_name)}
                        </div>
                    )}

                    {/* Delete User Button - Visible only to admin (مسلم عقيل) and when an employee is selected */}
                    {selectedEmployee && (currentUser?.full_name?.includes('مسلم عقيل') || currentUser?.full_name?.includes('مسلم قيل')) && (
                        <button
                            onClick={handleDeleteEmployee}
                            className="bg-red-500/10 text-red-500 p-2 rounded-xl hover:bg-red-500/20 transition-all active:scale-95 border border-red-500/20"
                            title="حذف الموظف نهائياً"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
            )}
        </div>
    );
};
