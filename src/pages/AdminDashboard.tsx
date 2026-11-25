import { useState, useRef, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { AccordionSection } from "../components/ui/AccordionSection";
import { ChevronDown, FileText, PieChart, AlertCircle, Shield, ScanSearch, User, Loader2, Wallet } from "lucide-react";
import { useEmployeeManager } from "../hooks/useEmployeeManager";
import { smoothScrollToId } from "../hooks/useSmoothScroll";
import { cn } from "../lib/utils";
import { DashboardHeader } from "../components/admin/dashboard/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { lazy, Suspense } from "react";
import { useTheme } from "../context/ThemeContext";
import { isDeveloperLevel } from "../utils/permissions";

const TrainingAndPromotionHub = lazy(() => import("../features/training/components/TrainingAndPromotionHub").then(m => ({ default: m.TrainingAndPromotionHub })));

const TipsEditor = lazy(() => import("../components/admin/TipsEditor"));
const PollCreator = lazy(() => import("../components/admin/PollCreator").then(m => ({ default: m.PollCreator })));
const MediaSectionEditor = lazy(() => import("../components/admin/MediaSectionEditor").then(m => ({ default: m.MediaSectionEditor })));
const CustomAudit = lazy(() => import("../components/admin/CustomAudit").then(m => ({ default: m.CustomAudit })));
const AdminLeaveRequests = lazy(() => import("../components/admin/AdminLeaveRequests").then(m => ({ default: m.AdminLeaveRequests })));
const DepartmentsManager = lazy(() => import("../components/admin/DepartmentsManager").then(m => ({ default: m.DepartmentsManager })));
const FiveYearLeaveDetailsModal = lazy(() => import("../components/admin/FiveYearLeaveDetailsModal").then(m => ({ default: m.FiveYearLeaveDetailsModal })));
const FiveYearLeaveHistoryModal = lazy(() => import("../components/admin/FiveYearLeaveHistoryModal").then(m => ({ default: m.FiveYearLeaveHistoryModal })));
const TabAddEmployee = lazy(() => import("../components/admin/dashboard/TabAddEmployee").then(m => ({ default: m.TabAddEmployee })));
const TabManageEmployees = lazy(() => import("../components/admin/dashboard/TabManageEmployees").then(m => ({ default: m.TabManageEmployees })));
const SupervisorPermissions = lazy(() => import("../components/admin/SupervisorPermissions").then(m => ({ default: m.SupervisorPermissions })));
const IncentivesTabContent = lazy(() => import("../components/features/IncentivesTabContent").then(m => ({ default: m.IncentivesTabContent })));
const AttendanceAdminSettings = lazy(() => import("../features/attendance").then(m => ({ default: m.AttendanceAdminSettings })));
const TabAdminStats = lazy(() => import("../components/admin/dashboard/TabAdminStats").then(m => ({ default: m.TabAdminStats })));


export const AdminDashboard = ({ onBack }: { onBack?: () => void }) => {
    const { user: currentUser } = useAuth();
    const { theme } = useTheme();
    const [searchParams, setSearchParams] = useSearchParams();

    const location = useLocation();

    // Strict helper just for account types (Role / Admin Role)
    const isRoleEditable = Boolean(isDeveloperLevel(currentUser?.admin_role) || currentUser?.admin_role === 'general' || currentUser?.full_name?.includes('مسلم عقيل') || currentUser?.full_name?.includes('مسلم قيل'));
    const canAddEmployee = isRoleEditable || currentUser?.admin_role === 'hr';
    const canAccessAttendance = Boolean(
        isRoleEditable ||
        currentUser?.has_attendance_access === true ||
        currentUser?.admin_role === 'biometric' ||
        currentUser?.admin_role === 'attendance_supervisor' ||
        currentUser?.username === 'attend'
    );

    // Determine default tab based on role or navigation state
    let baseTab = 'admin_manage';
    if (currentUser?.admin_role === 'biometric' || currentUser?.admin_role === 'attendance_supervisor' || currentUser?.username === 'attend') baseTab = 'admin_attendance';
    else if (currentUser?.admin_role === 'media') baseTab = 'admin_news';
    else if (canAddEmployee) baseTab = 'admin_add';
    else if (currentUser?.has_attendance_access && !isRoleEditable && currentUser?.admin_role !== 'hr' && currentUser?.admin_role !== 'finance') baseTab = 'admin_attendance';

    const defaultTab = location.state?.activeTab || baseTab;
    const [activeTab, setActiveTab] = useState<'admin_add' | 'admin_manage' | 'admin_incentives' | 'admin_stats' | 'admin_news' | 'admin_supervisors' | 'admin_training_courses' | 'admin_requests' | 'admin_departments' | 'admin_attendance'>(defaultTab as any);

    // Handle initial tab from URL cleanup
    useEffect(() => {
        if (searchParams.get('tab')) {
            searchParams.delete('tab');
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // Handle tab switching via custom events for reliable cross-component navigation
    useEffect(() => {
        const handleSwitchTab = (e: any) => {
            if (e.detail?.tab === 'admin_attendance') {
                setActiveTab('admin_attendance');
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
        };
        window.addEventListener('switch_dashboard_tab', handleSwitchTab);
        return () => window.removeEventListener('switch_dashboard_tab', handleSwitchTab);
    }, []);

    // Scroll to top when active tab changes
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [activeTab]);



    const detailsRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    const {
        loading, formData, setFormData, searchJobNumber, setSearchJobNumber,
        suggestions, showSuggestions, setShowSuggestions, searchExpanded, setSearchExpanded,
        selectedEmployee, setSelectedEmployee, financialData, setFinancialData,
        yearlyData,
        activeFiveYearLeave, showFiveYearLeaveModal, setShowFiveYearLeaveModal,
        showFiveYearLeaveHistoryModal, setShowFiveYearLeaveHistoryModal, newFiveYearLeave,
        selectedAdminYear, setSelectedAdminYear, adminRecords,
        fetchFieldPermissions, financialFields,
        showProfileUpdater, setShowProfileUpdater,
        loadEmployeeData, refreshSelectedEmployee, handleSearch, handleUpdateEmployee, handleSaveEmployee, handleDeleteEmployee,
        handleCreateFiveYearLeave, handleNewFiveYearLeaveChange, handleFiveYearLeaveChange,
        fetchAdminRecords, handleSaveRecord, handleDeleteRecord, handleFinancialChange, isFieldReadOnly
    } = useEmployeeManager(currentUser, setActiveTab as any, detailsRef as any);

    const [showSmartUpdater, setShowSmartUpdater] = useState(false);
    
    const [activeManageSubTab, setActiveManageSubTab] = useState<'main_info' | 'allowances_deductions' | 'admin_records'>('main_info');

    const [expandedSections, setExpandedSections] = useState({
        admin_summary: false,
        yearly_records: false, news_bar: false, polls: false, directives: false, conferences: false,
        sup_permissions: false, sup_custom_audit: false, sup_full_audit: false
    });

    const [openRecordSection, setOpenRecordSection] = useState<string | null>(null);

    const [showFieldPermissionsModal, setShowFieldPermissionsModal] = useState(false);
    const [showRequestsPermissionsModal, setShowRequestsPermissionsModal] = useState(false);
    const [showFixBalanceModal, setShowFixBalanceModal] = useState(false);
    const [showFinancialUpdater, setShowFinancialUpdater] = useState(false);
    const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);

    useEffect(() => {
        const handleNotificationNavigation = (e: any) => {
            setActiveTab('admin_requests');
            if (e.detail?.requestId) setHighlightRequestId(e.detail.requestId);
            if (e.detail?.employeeId) loadEmployeeData({ id: e.detail.employeeId });
        };
        window.addEventListener('navigate_to_hr_requests', handleNotificationNavigation);
        return () => window.removeEventListener('navigate_to_hr_requests', handleNotificationNavigation);
    }, []);

    // Auto-refresh employee data when switching back to manage tab without overriding an in-flight search selection
    useEffect(() => {
        if (activeTab === 'admin_manage') {
            refreshSelectedEmployee();
        }
    }, [activeTab]);

    const handleToggleRecordSection = (section: string) => {
        setOpenRecordSection(prev => {
            const newState = prev === section ? null : section;
            if (newState) {
                smoothScrollToId(`record-section-${section}`, 250);
            }
            return newState;
        });
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const isCurrentlyOpen = prev[sectionId as keyof typeof prev];
            const newState = {
                admin_summary: false,
                yearly_records: false, news_bar: false, polls: false, directives: false, conferences: false,
                sup_permissions: false, sup_custom_audit: false, sup_full_audit: false
            };
            if (!isCurrentlyOpen) {
                newState[sectionId as keyof typeof newState] = true;
                smoothScrollToId(`section-${sectionId}`, 125);
            }
            return newState;
        });
    };

    const handleSelectManageSubTab = (subTab: 'main_info' | 'allowances_deductions' | 'admin_records') => {
        setActiveManageSubTab(subTab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSelectSuggestion = async (user: any) => {
        setShowSuggestions(false);
        await loadEmployeeData(user);
    };

    useEffect(() => {
        if (activeTab === 'admin_manage' && selectedEmployee && activeManageSubTab === 'admin_records') {
            fetchAdminRecords();
        }
    }, [activeTab, selectedEmployee?.id, selectedAdminYear, activeManageSubTab]);

    // Updated Header Component
    const dashboardHeader = (
        <DashboardHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            isRoleEditable={isRoleEditable}
            canAddEmployee={canAddEmployee}
            canAccessAttendance={canAccessAttendance}
            isFieldReadOnly={isFieldReadOnly}
            theme={theme}
            selectedAdminYear={selectedAdminYear}
            setSelectedAdminYear={setSelectedAdminYear}
            selectedEmployee={selectedEmployee}
            handleSaveEmployee={handleSaveEmployee}
            handleUpdateEmployee={handleUpdateEmployee}
            loading={loading}
            searchExpanded={searchExpanded}
            setSearchExpanded={setSearchExpanded}
            searchJobNumber={searchJobNumber}
            setSearchJobNumber={setSearchJobNumber}
            handleSearch={handleSearch}
            suggestions={suggestions}
            setShowSuggestions={setShowSuggestions}
            showSuggestions={showSuggestions}
            searchRef={searchRef}
            handleSelectSuggestion={handleSelectSuggestion}
            handleDeleteEmployee={handleDeleteEmployee}
        />
    );

    const manageStickySubHeader = (activeTab === 'admin_manage' && selectedEmployee) ? (
        <div className={cn(
            "grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl border backdrop-blur-xl shadow-md",
            theme === 'light'
                ? "bg-white/95 border-gray-200/80 shadow-gray-200/40"
                : "bg-[#0f172a]/90 border-white/10 shadow-black/40"
        )}>
            <button
                type="button"
                onClick={() => handleSelectManageSubTab('main_info')}
                className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 active:scale-95",
                    activeManageSubTab === 'main_info'
                        ? "bg-teal-600 text-white shadow-md shadow-teal-500/25"
                        : theme === 'light'
                            ? "text-slate-700 hover:bg-teal-50 hover:text-teal-700"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
            >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">معلومات اساسية</span>
            </button>

            <button
                type="button"
                onClick={() => handleSelectManageSubTab('allowances_deductions')}
                className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 active:scale-95",
                    activeManageSubTab === 'allowances_deductions'
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                        : theme === 'light'
                            ? "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
            >
                <Wallet className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">المخصصات والاستقطاعات</span>
            </button>

            <button
                type="button"
                onClick={() => handleSelectManageSubTab('admin_records')}
                className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 active:scale-95",
                    activeManageSubTab === 'admin_records'
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                        : theme === 'light'
                            ? "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
            >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">إدارة السجلات</span>
            </button>
        </div>
    ) : undefined;

    return (
        <Layout headerTitle="إدارة النظام" showUserName={true} headerContent={dashboardHeader} stickySubHeader={manageStickySubHeader} className="relative bg-transparent" onBack={onBack}>
            {/* TAB: Departments Manager */}
            {activeTab === 'admin_departments' && (
                <DepartmentsManager theme={theme} />
            )}

            {/* TAB: Add Employee */}
            {activeTab === 'admin_add' && (
                <TabAddEmployee
                    formData={formData}
                    setFormData={setFormData}
                    isRoleEditable={isRoleEditable}
                    theme={theme}
                    handleSaveEmployee={handleSaveEmployee}
                    loading={loading}
                />
            )}

            {/* TAB: Manage Employees */}
            {activeTab === 'admin_manage' && (
                <TabManageEmployees
                    selectedEmployee={selectedEmployee}
                    setSelectedEmployee={setSelectedEmployee}
                    detailsRef={detailsRef}
                    activeManageSubTab={activeManageSubTab}
                    financialData={financialData}
                    setFinancialData={setFinancialData}
                    isFieldReadOnly={isFieldReadOnly}
                    isRoleEditable={isRoleEditable}
                    theme={theme}
                    financialFields={financialFields}
                    handleFinancialChange={handleFinancialChange}
                    currentUser={currentUser}
                    showSmartUpdater={showSmartUpdater}
                    setShowSmartUpdater={setShowSmartUpdater}
                    showProfileUpdater={showProfileUpdater}
                    setShowProfileUpdater={setShowProfileUpdater}
                    showFieldPermissionsModal={showFieldPermissionsModal}
                    setShowFieldPermissionsModal={setShowFieldPermissionsModal}
                    showRequestsPermissionsModal={showRequestsPermissionsModal}
                    setShowRequestsPermissionsModal={setShowRequestsPermissionsModal}
                    showFixBalanceModal={showFixBalanceModal}
                    setShowFixBalanceModal={setShowFixBalanceModal}
                    showFinancialUpdater={showFinancialUpdater}
                    setShowFinancialUpdater={setShowFinancialUpdater}
                    fetchFieldPermissions={fetchFieldPermissions}
                    yearlyData={yearlyData}
                    selectedAdminYear={selectedAdminYear}
                    setSelectedAdminYear={setSelectedAdminYear}
                    adminRecords={adminRecords}
                    handleSaveRecord={handleSaveRecord}
                    handleDeleteRecord={handleDeleteRecord}
                    openRecordSection={openRecordSection}
                    handleToggleRecordSection={handleToggleRecordSection}
                    activeFiveYearLeave={activeFiveYearLeave}
                    setShowFiveYearLeaveModal={setShowFiveYearLeaveModal}
                    setShowFiveYearLeaveHistoryModal={setShowFiveYearLeaveHistoryModal}
                    handleFiveYearLeaveChange={handleFiveYearLeaveChange}
                    newFiveYearLeave={newFiveYearLeave}
                    handleNewFiveYearLeaveChange={handleNewFiveYearLeaveChange}
                    handleCreateFiveYearLeave={handleCreateFiveYearLeave}
                    loading={loading}
                />
            )}

            {/* ======= الحوافز TAB ======= */}
            {activeTab === 'admin_incentives' && (
                <div className="max-w-7xl mx-auto px-0 sm:px-2 relative pb-2 mt-0 sm:mt-1 animate-in fade-in slide-in-from-right-5 duration-300 w-full">
                    <IncentivesTabContent isAdminView={true} />
                </div>
            )}

            {/* ======= الإحصاءات TAB ======= */}
            {activeTab === 'admin_stats' && (
                <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
                    <TabAdminStats theme={theme} />
                </Suspense>
            )}


            {/* News Ticker Tab */}
            {activeTab === 'admin_news' && (
                <div className="space-y-6 mx-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <AccordionSection
                        id="news_bar"
                        title="إدارة شريط الاخبار"
                        icon={FileText}
                        isOpen={expandedSections.news_bar}
                        color="from-teal-600 to-teal-500"
                        onToggle={() => toggleSection('news_bar')}
                    >
                        <div className="p-2">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-white/60 text-sm leading-relaxed">
                                    يمكنك هنا تحديث شريط الاخبار الذي يظهر في أسفل التطبيق لجميع المستخدمين.
                                </p>
                                <button
                                    onClick={() => toggleSection('news_bar')}
                                    className="text-white/40 hover:text-white flex items-center gap-1 text-xs transition-colors"
                                >
                                    <ChevronDown className="w-4 h-4 rotate-180" />
                                    إغلاق
                                </button>
                            </div>
                            <TipsEditor appName="InfTeleKarbala" />
                        </div>
                    </AccordionSection>

                    <AccordionSection
                        id="polls"
                        title="الاستطلاعات"
                        icon={PieChart}
                        isOpen={expandedSections.polls}
                        color="from-purple-600 to-purple-500"
                        onToggle={() => toggleSection('polls')}
                    >
                        <div className="p-2">
                            <PollCreator />
                        </div>
                    </AccordionSection>

                    <AccordionSection
                        id="directives"
                        title="التوجيهات"
                        icon={AlertCircle}
                        isOpen={expandedSections.directives}
                        color="from-red-600 to-red-500"
                        onToggle={() => toggleSection('directives')}
                    >
                        <div className="p-2">
                            <MediaSectionEditor
                                type="directive"
                                title="محتوى التوجيهات الهامة"
                                placeholder="اكتب التوجيه هنا... سيظهر هذا النص في نافذة منبثقة حمراء تتطلب تأكيد القراءة."
                            />
                        </div>
                    </AccordionSection>

                    <AccordionSection
                        id="conferences"
                        title="النشاطات"
                        icon={User}
                        isOpen={expandedSections.conferences}
                        color="from-green-600 to-green-500"
                        onToggle={() => toggleSection('conferences')}
                    >
                        <div className="p-2">
                            <MediaSectionEditor
                                type="conference"
                                title="محتوى النشاطات"
                                placeholder="اكتب تفاصيل المؤتمر هنا... سيظهر هذا النص في نافذة خضراء."
                            />
                        </div>
                    </AccordionSection>
                </div>
            )}

            {/* ======= المشرفون TAB ======= */}
            {activeTab === 'admin_supervisors' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-5 duration-300">
                    <div className={cn(
                        "rounded-2xl p-5 border",
                        theme === 'light'
                            ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60"
                            : "bg-gradient-to-br from-amber-950/30 to-orange-950/20 border-amber-500/10"
                    )}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                theme === 'light'
                                    ? "bg-amber-500/10 text-amber-600"
                                    : "bg-amber-500/20 text-amber-400"
                            )}>
                                <Shield className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className={cn("text-lg font-bold", theme === 'light' ? "text-amber-900" : "text-amber-300")}>لوحة المشرفين</h2>
                                <p className={cn("text-xs", theme === 'light' ? "text-amber-700/70" : "text-amber-400/60")}>التدقيق والرقابة المالية والإدارية</p>
                            </div>
                        </div>
                    </div>

                    <AccordionSection
                        id="sup_permissions"
                        title="صلاحيات المشرفين"
                        icon={Shield}
                        isOpen={expandedSections.sup_permissions}
                        color="from-amber-600 to-yellow-500"
                        onToggle={() => toggleSection('sup_permissions')}
                    >
                        <SupervisorPermissions theme={theme} />
                    </AccordionSection>

                    <AccordionSection
                        id="sup_custom_audit"
                        title="تدقيق مخصص"
                        icon={ScanSearch}
                        isOpen={expandedSections.sup_custom_audit}
                        color="from-cyan-600 to-teal-500"
                        onToggle={() => toggleSection('sup_custom_audit')}
                    >
                        <div className="p-4">
                            <CustomAudit onClose={() => toggleSection('sup_custom_audit')} />
                        </div>
                    </AccordionSection>
                </div>
            )}

            {/* ======= الطلبات TAB ======= */}
            {activeTab === 'admin_requests' && (
                <div className="max-w-4xl mx-auto px-4 relative pb-2 mt-6 animate-in fade-in slide-in-from-right-5 duration-300 w-full">
                    <AdminLeaveRequests
                        employeeId={selectedEmployee?.id}
                        employeeName={selectedEmployee?.full_name}
                        highlightRequestId={highlightRequestId}
                    />
                </div>
            )}

            {/* ======= تدريب ودورات TAB ======= */}
            {activeTab === 'admin_training_courses' && (
                <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>}>
                    <TrainingAndPromotionHub isAdminDashboard={true} />
                </Suspense>
            )}

            {/* ======= إعداد البصمة TAB ======= */}
            {activeTab === 'admin_attendance' && (
                <div className="-mt-4 md:-mt-6">
                    <AttendanceAdminSettings />
                </div>
            )}

            <FiveYearLeaveDetailsModal
                isOpen={showFiveYearLeaveModal}
                onClose={() => setShowFiveYearLeaveModal(false)}
                leave={activeFiveYearLeave}
                financialData={financialData}
                currentUser={currentUser}
                onRefresh={() => {
                    if (selectedEmployee) loadEmployeeData(selectedEmployee);
                }}
            />

            <FiveYearLeaveHistoryModal
                isOpen={showFiveYearLeaveHistoryModal}
                onClose={() => setShowFiveYearLeaveHistoryModal(false)}
                leave={activeFiveYearLeave}
            />
        </Layout >
    );
};

