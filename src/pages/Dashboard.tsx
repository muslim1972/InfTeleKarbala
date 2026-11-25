import { useState, useEffect, Suspense, lazy } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { TabSystem, type UserDashboardTab } from "../components/features/TabSystem";
import { UserPolls } from "../components/features/UserPolls";
import { RequestsTabContent } from "../features/requests/components/RequestsTabContent";
import { AudioHub } from "../components/features/AudioHub";
import { FinancialTabContent } from "../components/features/FinancialTabContent";
import { AdministrativeTabContent } from "../components/features/AdministrativeTabContent";
import { KnowledgeTabContent } from "../components/features/knowledge/KnowledgeTabContent";
import { SupervisedDutyRoster } from "../features/attendance/components/SupervisedDutyRoster";
import { useDashboardData } from "../hooks/useDashboardData";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { isDeveloperLevel } from "../utils/permissions";
import { Loader2, User, Activity, Scissors } from "lucide-react";
import { cn } from "../lib/utils";

const AttendanceAdminSettings = lazy(() => import("../features/attendance").then(m => ({ default: m.AttendanceAdminSettings })));
const TabAdminStats = lazy(() => import("../components/admin/dashboard/TabAdminStats").then(m => ({ default: m.TabAdminStats })));
const IncentivesTabContent = lazy(() => import("../components/features/IncentivesTabContent").then(m => ({ default: m.IncentivesTabContent })));
const TrainingAndPromotionHub = lazy(() => import("../features/training/components/TrainingAndPromotionHub").then(m => ({ default: m.TrainingAndPromotionHub })));

export const Dashboard = ({ onBack }: { onBack?: () => void }) => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    const isBiometricOnly = Boolean(
        (user?.admin_role === 'biometric' || user?.admin_role === 'attendance_supervisor' || user?.username === 'attend') &&
        user?.admin_role !== 'general' &&
        !isDeveloperLevel(user?.admin_role)
    );

    const allowedTabs = ['financial', 'administrative', 'polls', 'requests', 'incentives', 'training_courses', 'audio', 'knowledge', 'supervision', 'attendance_admin', 'attendance_stats'];

    const [activeTab, setActiveTab] = useState<UserDashboardTab>(() => {
        const urlTab = new URLSearchParams(window.location.search).get('tab');
        const stateTab = (location.state as any)?.tab;
        const target = urlTab || stateTab;
        if (target && allowedTabs.includes(target)) {
            return target as any;
        }
        if (isBiometricOnly) {
            return 'attendance_admin';
        }
        return 'administrative';
    });

    const {
        financialData, loading, departmentInfo,
        openSection, toggleSection,
        adminData, currentYearRecord,
        expandedDetail, handleDetailClick, detailLoading, detailItems,
        leavesList, selectedLeave, setSelectedLeave
    } = useDashboardData(activeTab);

    // Handle initial tab from URL or navigation state
    useEffect(() => {
        const urlTab = searchParams.get('tab');
        const stateTab = (location.state as any)?.tab;
        const targetTab = urlTab || stateTab;
        if (targetTab && allowedTabs.includes(targetTab)) {
            queueMicrotask(() => {
                setActiveTab(prev => (prev !== targetTab ? (targetTab as any) : prev));
            });
            if (urlTab) {
                searchParams.delete('tab');
                setSearchParams(searchParams, { replace: true });
            }
        }
    }, [searchParams, setSearchParams, location.state]);

    // Handle tab switching via custom events
    useEffect(() => {
        const handleSwitchTab = (e: any) => {
            if (e.detail?.tab && allowedTabs.includes(e.detail.tab)) {
                setActiveTab(e.detail.tab);
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
        };
        window.addEventListener('switch_dashboard_tab', handleSwitchTab);
        
        const handleNavigateToRequests = () => {
            setActiveTab('requests');
            window.scrollTo({ top: 0, behavior: 'instant' });
        };
        window.addEventListener('navigate_to_user_requests', handleNavigateToRequests);

        return () => {
            window.removeEventListener('switch_dashboard_tab', handleSwitchTab);
            window.removeEventListener('navigate_to_user_requests', handleNavigateToRequests);
        };
    }, []);

    // Scroll to top when switching tabs
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [activeTab]);

    const [activeAdminSubTab, setActiveAdminSubTab] = useState<'basic' | 'movements' | 'leaves'>('basic');

    const handleSelectAdminSubTab = (subTab: 'basic' | 'movements' | 'leaves') => {
        setActiveAdminSubTab(subTab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const headerContent = (
        <div className="flex flex-col gap-2 w-full">
            <TabSystem activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
    );

    const adminStickySubHeader = activeTab === 'administrative' ? (
        <div className={cn(
            "grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl border backdrop-blur-xl shadow-md",
            theme === 'light'
                ? "bg-white/95 border-gray-200/80 shadow-gray-200/40"
                : "bg-[#0f172a]/90 border-white/10 shadow-black/40"
        )}>
            <button
                type="button"
                onClick={() => handleSelectAdminSubTab('basic')}
                className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 active:scale-95",
                    activeAdminSubTab === 'basic'
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                        : theme === 'light'
                            ? "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
            >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">المعلومات الاساسية</span>
            </button>

            <button
                type="button"
                onClick={() => handleSelectAdminSubTab('movements')}
                className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 active:scale-95",
                    activeAdminSubTab === 'movements'
                        ? "bg-purple-600 text-white shadow-md shadow-purple-500/25"
                        : theme === 'light'
                            ? "text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
            >
                <Activity className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">الحركات</span>
            </button>

            <button
                type="button"
                onClick={() => handleSelectAdminSubTab('leaves')}
                className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 active:scale-95",
                    activeAdminSubTab === 'leaves'
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                        : theme === 'light'
                            ? "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
            >
                <Scissors className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">الاجازات ({currentYearRecord?.leaves_taken || 0})</span>
            </button>
        </div>
    ) : undefined;

    const isBroadTab = activeTab === 'attendance_admin' || activeTab === 'attendance_stats' || activeTab === 'supervision';

    return (
        <Layout headerContent={headerContent} stickySubHeader={adminStickySubHeader} headerTitle="لوحة الموظف" showUserName={true} onBack={onBack}>
            <div className={cn("mx-auto relative pb-2 mt-2 bg-transparent", isBroadTab ? "w-full max-w-7xl px-1 sm:px-2" : "max-w-4xl px-4")}>
                {activeTab === 'polls' ? (
                    <UserPolls />
                ) : activeTab === 'requests' ? (
                    <RequestsTabContent />
                ) : activeTab === 'incentives' ? (
                    <Suspense fallback={<div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-green" /></div>}>
                        <IncentivesTabContent isAdminView={false} />
                    </Suspense>
                ) : activeTab === 'training_courses' ? (
                    <Suspense fallback={<div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" /></div>}>
                        <TrainingAndPromotionHub isAdminDashboard={false} />
                    </Suspense>
                ) : activeTab === 'knowledge' ? (
                    <KnowledgeTabContent />
                ) : activeTab === 'audio' ? (
                    <AudioHub />
                ) : activeTab === 'supervision' ? (
                    <SupervisedDutyRoster user={user} />
                ) : activeTab === 'attendance_admin' ? (
                    <Suspense fallback={<div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>}>
                        <AttendanceAdminSettings />
                    </Suspense>
                ) : activeTab === 'attendance_stats' ? (
                    <Suspense fallback={<div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>}>
                        <TabAdminStats theme={theme} />
                    </Suspense>
                ) : activeTab === 'financial' ? (
                    <FinancialTabContent 
                        user={user}
                        financialData={financialData}
                        loading={loading}
                        adminData={adminData}
                        openSection={openSection}
                        toggleSection={toggleSection}
                    />
                ) : (
                    <AdministrativeTabContent 
                        currentYearRecord={currentYearRecord}
                        expandedDetail={expandedDetail}
                        handleDetailClick={handleDetailClick as any}
                        detailLoading={detailLoading}
                        detailItems={detailItems}
                        financialData={financialData}
                        leavesList={leavesList}
                        selectedLeave={selectedLeave}
                        setSelectedLeave={setSelectedLeave}
                        user={user}
                        departmentInfo={departmentInfo}
                        openSection={openSection}
                        toggleSection={toggleSection}
                        activeSubTab={activeAdminSubTab}
                    />
                )}
            </div>
        </Layout>
    );
};
