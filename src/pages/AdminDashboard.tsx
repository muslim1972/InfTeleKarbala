import { useState, useRef, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { AccordionSection } from "../components/ui/AccordionSection";
import { ChevronDown, FileText, PieChart, AlertCircle, Shield, ScanSearch, User } from "lucide-react";
import { useEmployeeManager } from "../hooks/useEmployeeManager";
import { cn } from "../lib/utils";
import TipsEditor from "../components/admin/TipsEditor";
import { PollCreator } from "../components/admin/PollCreator";
import { MediaSectionEditor } from "../components/admin/MediaSectionEditor";
import { CustomAudit } from "../components/admin/CustomAudit";
import { TrainingTabContent } from "../components/features/TrainingTabContent";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { AdminLeaveRequests } from "../components/admin/AdminLeaveRequests";
import { AppNotifications } from "../components/features/AppNotifications";
import { DepartmentsManager } from "../components/admin/DepartmentsManager";
import { FiveYearLeaveDetailsModal } from "../components/admin/FiveYearLeaveDetailsModal";
import { FiveYearLeaveHistoryModal } from "../components/admin/FiveYearLeaveHistoryModal";
import { TabAddEmployee } from "../components/admin/dashboard/TabAddEmployee";
import { DashboardHeader } from "../components/admin/dashboard/DashboardHeader";
import { TabManageEmployees } from "../components/admin/dashboard/TabManageEmployees";
import { TabAdminRecords } from "../components/admin/dashboard/TabAdminRecords";
import { AudioHub } from "../components/features/AudioHub";
import { SupervisorPermissions } from "../components/admin/SupervisorPermissions";

export const AdminDashboard = () => {
    const { user: currentUser } = useAuth();
    const { theme } = useTheme();
    const [searchParams, setSearchParams] = useSearchParams();

    const location = useLocation();

    // Strict helper just for account types (Role / Admin Role)
    const isRoleEditable = Boolean(currentUser?.admin_role === 'developer' || currentUser?.admin_role === 'general' || currentUser?.full_name?.includes('مسلم عقيل') || currentUser?.full_name?.includes('مسلم قيل'));
    const canAddEmployee = isRoleEditable || currentUser?.admin_role === 'hr';

    // Determine default tab based on role or navigation state
    let baseTab = 'admin_manage';
    if (currentUser?.admin_role === 'media') baseTab = 'admin_news';
    else if (canAddEmployee) baseTab = 'admin_add';

    const defaultTab = location.state?.activeTab || baseTab;
    const [activeTab, setActiveTab] = useState<'admin_add' | 'admin_manage' | 'admin_records' | 'admin_news' | 'admin_supervisors' | 'admin_training' | 'admin_requests' | 'admin_departments' | 'admin_audio'>(defaultTab as any);

    // Handle initial tab from URL
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'admin_audio') {
            setActiveTab('admin_audio');
            // Clean up the URL
            searchParams.delete('tab');
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // Handle tab switching via custom events for reliable cross-component navigation
    useEffect(() => {
        const handleSwitchTab = (e: any) => {
            if (e.detail?.tab === 'admin_audio') {
                setActiveTab('admin_audio');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
        window.addEventListener('switch_dashboard_tab', handleSwitchTab);
        return () => window.removeEventListener('switch_dashboard_tab', handleSwitchTab);
    }, []);


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
        loadEmployeeData, handleSearch, handleUpdateEmployee, handleSaveEmployee, handleDeleteEmployee,
        handleCreateFiveYearLeave, handleNewFiveYearLeaveChange, handleFiveYearLeaveChange,
        fetchAdminRecords, handleSaveRecord, handleDeleteRecord, handleFinancialChange, isFieldReadOnly
    } = useEmployeeManager(currentUser, setActiveTab as any, detailsRef as any);

    const [showDataPatcher, setShowDataPatcher] = useState(false);
    const [showSmartUpdater, setShowSmartUpdater] = useState(false);
    
    const [expandedSections, setExpandedSections] = useState({
        main_info: false, basic: false, allowances: false, deductions: false, admin_summary: false,
        yearly_records: false, news_bar: false, polls: false, directives: false, conferences: false,
        sup_permissions: false, sup_custom_audit: false, sup_full_audit: false
    });

    const [openRecordSection, setOpenRecordSection] = useState<string | null>(null);

    const [showFieldPermissionsModal, setShowFieldPermissionsModal] = useState(false);
    const [showRequestsPermissionsModal, setShowRequestsPermissionsModal] = useState(false);
    const [showFixBalanceModal, setShowFixBalanceModal] = useState(false);
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

    const handleToggleRecordSection = (section: string) => {
        setOpenRecordSection(prev => {
            const newState = prev === section ? null : section;
            if (newState) {
                setTimeout(() => {
                    const element = document.getElementById(`record-section-${section}`);
                    if (element) {
                        const y = element.getBoundingClientRect().top + window.scrollY - 250;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                }, 100);
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
                main_info: false, basic: false, allowances: false, deductions: false, admin_summary: false,
                yearly_records: false, news_bar: false, polls: false, directives: false, conferences: false,
                sup_permissions: false, sup_custom_audit: false, sup_full_audit: false
            };
            if (!isCurrentlyOpen) {
                newState[sectionId as keyof typeof newState] = true;
                setTimeout(() => {
                    const element = document.getElementById(`section-${sectionId}`);
                    if (element) {
                        const offsetPosition = element.getBoundingClientRect().top + window.pageYOffset - 125;
                        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                    }
                }, 100);
            }
            return newState;
        });
    };

    const handleSelectSuggestion = async (user: any) => {
        setShowSuggestions(false);
        await loadEmployeeData(user);
    };

    useEffect(() => {
        if (activeTab === 'admin_records' && selectedEmployee) fetchAdminRecords();
    }, [activeTab, selectedEmployee, selectedAdminYear]);

    // Updated Header Component
    const dashboardHeader = (
        <DashboardHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            isRoleEditable={isRoleEditable}
            canAddEmployee={canAddEmployee}
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

    return (
        <Layout headerTitle="إدارة النظام" showUserName={true} headerContent={dashboardHeader} className="relative min-h-screen bg-transparent">
            <AppNotifications />
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
                />
            )}

            {/* TAB: Manage Employees */}
            {activeTab === 'admin_manage' && (
                <TabManageEmployees
                    selectedEmployee={selectedEmployee}
                    setSelectedEmployee={setSelectedEmployee}
                    detailsRef={detailsRef}
                    expandedSections={expandedSections}
                    toggleSection={toggleSection}
                    financialData={financialData}
                    setFinancialData={setFinancialData}
                    isFieldReadOnly={isFieldReadOnly}
                    isRoleEditable={isRoleEditable}
                    theme={theme}
                    financialFields={financialFields}
                    handleFinancialChange={handleFinancialChange}
                    currentUser={currentUser}
                    showDataPatcher={showDataPatcher}
                    setShowDataPatcher={setShowDataPatcher}
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
                    fetchFieldPermissions={fetchFieldPermissions}
                    handleFiveYearLeaveChange={handleFiveYearLeaveChange}
                />
            )}

            {/* ======= السجلات الإدارية TAB ======= */}
            {activeTab === 'admin_records' && (
                <TabAdminRecords
                    selectedEmployee={selectedEmployee}
                    yearlyData={yearlyData}
                    selectedAdminYear={selectedAdminYear}
                    adminRecords={adminRecords}
                    handleSaveRecord={handleSaveRecord}
                    handleDeleteRecord={handleDeleteRecord}
                    openRecordSection={openRecordSection}
                    handleToggleRecordSection={handleToggleRecordSection}
                    isFieldReadOnly={isFieldReadOnly}
                    activeFiveYearLeave={activeFiveYearLeave}
                    setShowFiveYearLeaveModal={setShowFiveYearLeaveModal}
                    setShowFiveYearLeaveHistoryModal={setShowFiveYearLeaveHistoryModal}
                    financialData={financialData}
                    handleFiveYearLeaveChange={handleFiveYearLeaveChange}
                    newFiveYearLeave={newFiveYearLeave}
                    handleNewFiveYearLeaveChange={handleNewFiveYearLeaveChange}
                    handleCreateFiveYearLeave={handleCreateFiveYearLeave}
                    loading={loading}
                />
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

            {/* ======= التدريب الصيفي TAB ======= */}
            {activeTab === 'admin_training' && (
                <div className="max-w-4xl mx-auto px-4 relative pb-20 mt-6 animate-in fade-in slide-in-from-right-5 duration-300 w-full">
                    <TrainingTabContent isAdmin={true} />
                </div>
            )}

            {/* ======= الطلبات TAB ======= */}
            {activeTab === 'admin_requests' && (
                <div className="max-w-4xl mx-auto px-4 relative pb-20 mt-6 animate-in fade-in slide-in-from-right-5 duration-300 w-full">
                    <AdminLeaveRequests
                        employeeId={selectedEmployee?.id}
                        employeeName={selectedEmployee?.full_name}
                        highlightRequestId={highlightRequestId}
                    />
                </div>
            )}

            {/* ======= القرآن الكريم TAB ======= */}
            {activeTab === 'admin_audio' && (
                <div className="max-w-4xl mx-auto px-4 relative pb-20 mt-6 animate-in fade-in slide-in-from-right-5 duration-300 w-full">
                    <AudioHub />
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
