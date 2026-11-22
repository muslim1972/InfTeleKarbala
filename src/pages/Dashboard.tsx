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
import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

const AttendanceAdminSettings = lazy(() => import("../features/attendance").then(m => ({ default: m.AttendanceAdminSettings })));
const TabAdminStats = lazy(() => import("../components/admin/dashboard/TabAdminStats").then(m => ({ default: m.TabAdminStats })));

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

    const allowedTabs = ['financial', 'administrative', 'polls', 'requests', 'audio', 'knowledge', 'attendance_admin', 'attendance_stats'];

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

    const headerContent = (
        <div className="flex flex-col gap-2 w-full">
            <TabSystem activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
    );

    const isBroadTab = activeTab === 'attendance_admin' || activeTab === 'attendance_stats' || activeTab === 'supervision';

    return (
        <Layout headerContent={headerContent} headerTitle="لوحة الموظف" showUserName={true} onBack={onBack}>
            <div className={cn("mx-auto relative pb-32 sm:pb-40 mt-2 bg-transparent", isBroadTab ? "w-full max-w-7xl px-1 sm:px-2" : "max-w-4xl px-4")}>
                {activeTab === 'polls' ? (
                    <UserPolls />
                ) : activeTab === 'requests' ? (
                    <RequestsTabContent />
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
                    />
                )}
            </div>
        </Layout>
    );
};
