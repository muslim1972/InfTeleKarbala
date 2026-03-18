
import { Search, Loader2, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { ScrollableTabs } from "../../ui/ScrollableTabs";
import { YearSlider } from "../../features/YearSlider";
import { cn } from "../../../lib/utils";

interface DashboardHeaderProps {
    activeTab: string;
    setActiveTab: (tab: any) => void;
    currentUser: any;
    isRoleEditable: boolean;
    canAddEmployee: boolean;
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
    isFieldReadOnly,
    theme,
    selectedAdminYear,
    setSelectedAdminYear,
    selectedEmployee,
    handleSaveEmployee,
    handleUpdateEmployee,
    loading,
    searchExpanded,
    setSearchExpanded,
    searchJobNumber,
    setSearchJobNumber,
    handleSearch,
    suggestions,
    setShowSuggestions,
    showSuggestions,
    searchRef,
    handleSelectSuggestion,
    handleDeleteEmployee
}: DashboardHeaderProps) => {

    const tabs = (() => {
        const canAccessNews = isRoleEditable || currentUser?.admin_role === 'media';

        const allTabs = [
            ...(canAddEmployee ? [{ id: 'admin_add', label: 'إضافة موظف' }] : []),
            { id: 'admin_manage', label: 'إدارة الموظفين' },
            { id: 'admin_records', label: 'إدارة السجلات' },
            ...(canAccessNews ? [{ id: 'admin_news', label: 'الاعلام' }] : []),
            { id: 'admin_departments', label: 'الهيكلية الإدارية' },
            ...(isFieldReadOnly('tab_requests') ? [] : [{ id: 'admin_requests', label: 'الطلبات' }]),
            ...(isFieldReadOnly('tab_supervisors') ? [] : [{ id: 'admin_supervisors', label: 'المشرفون' }]),
            ...(isFieldReadOnly('tab_training') ? [] : [{ id: 'admin_training', label: 'التدريب الصيفي' }])
        ];

        return allTabs;
    })();

    return (
        <div className="space-y-3">
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

            {/* Search & Year Slider (Unified Toolbar) */}
            <div className="flex items-center justify-between gap-3 relative overflow-visible h-10 min-h-[40px]">

                {/* Right Side (Start in RTL): Year Slider (Reserved Slot) */}
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
                        <button
                            onClick={(e) => activeTab === 'admin_add' ? handleSaveEmployee(e) : handleUpdateEmployee()}
                            disabled={loading || currentUser?.admin_role === 'media'}
                            title={currentUser?.admin_role === 'media' ? "ليس لديك صلاحية الحفظ" : "حفظ التعديلات"}
                            className="w-full py-2 px-2 bg-brand-green hover:bg-brand-green/90 text-white rounded-lg font-bold text-xs flex items-center justify-center shadow-lg shadow-brand-green/20 disabled:opacity-50 transition-all animate-in fade-in zoom-in duration-300 whitespace-nowrap"
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-2" /> : null}
                            <span>حفظ التعديل والاضافة</span>
                        </button>
                    ) : (
                        <div id="admin-header-portal" className="w-full h-full flex items-center" />
                    )}
                </div>

                {/* Left Side (End in RTL): Name + Search */}
                <div className="flex items-center gap-3">

                    {/* User Name - Hidden when search is expanded */}
                    {!searchExpanded && selectedEmployee && (
                        <h3 className={`font-bold text-sm animate-in fade-in duration-200 ${theme === 'light' ? 'text-gray-900' : 'text-white'
                            }`}>
                            {selectedEmployee.full_name}
                        </h3>
                    )}

                    {/* Search Button & Input */}
                    <div className="flex items-center gap-2 relative overflow-visible" ref={searchRef}>
                        {searchExpanded && (
                            <div className="relative animate-in slide-in-from-right-5 fade-in duration-300 overflow-visible">
                                <input
                                    type="text"
                                    placeholder="الرقم الوظيفي أو الاسم"
                                    value={searchJobNumber}
                                    onChange={e => setSearchJobNumber(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    onFocus={() => {
                                        if (suggestions.length > 0) setShowSuggestions(true);
                                    }}
                                    autoFocus
                                    className={`w-40 md:w-64 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 transition-all ${theme === 'light'
                                        ? 'bg-gray-50 border-gray-200 text-black placeholder:text-gray-400'
                                        : 'bg-white/10 border-white/10 text-white placeholder:text-white/40'
                                        }`}
                                />
                                
                                {/* Suggestions Dropdown */}
                                {showSuggestions && suggestions.length > 0 && createPortal(
                                    <div 
                                        className={`fixed z-[9999] mt-2 w-64 md:w-80 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 ${
                                            theme === 'light' 
                                            ? 'bg-white/95 border-gray-100' 
                                            : 'bg-slate-900/95 border-white/5'
                                        }`}
                                        style={{
                                            top: searchRef.current?.getBoundingClientRect().bottom ?? 0,
                                            left: searchRef.current?.getBoundingClientRect().left ?? 0
                                        }}
                                    >
                                        <div className="max-h-[300px] overflow-y-auto scrollbar-hide py-2">
                                            {suggestions.map((sug) => (
                                                <button
                                                    key={sug.id}
                                                    onMouseDown={() => {
                                                        handleSelectSuggestion(sug);
                                                        setSearchJobNumber(sug.full_name);
                                                        setShowSuggestions(false);
                                                    }}
                                                    className={`w-full text-right px-4 py-3 flex items-center justify-between transition-colors ${
                                                        theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-white/5'
                                                    }`}
                                                >
                                                    <div>
                                                        <div className={`font-bold text-sm ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{sug.full_name}</div>
                                                        <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-white/40'}`}>{sug.job_number}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>,
                                    document.body
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => setSearchExpanded(!searchExpanded)}
                            className={cn(
                                "p-2 rounded-xl transition-all active:scale-95",
                                theme === 'light'
                                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    : "bg-white/5 text-white/60 hover:bg-white/10",
                                searchExpanded && "bg-brand-green/20 text-brand-green"
                            )}
                        >
                            <Search className="w-5 h-5" />
                        </button>

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
            </div>
        </div>
    );
};
