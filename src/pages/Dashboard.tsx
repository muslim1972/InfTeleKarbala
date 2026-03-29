import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { TabSystem } from "../components/features/TabSystem";
import { YearSlider } from "../components/features/YearSlider";
import { AppNotifications } from "../components/features/AppNotifications";
import { UserPolls } from "../components/features/UserPolls";
import { RequestsTabContent } from "../features/requests/components/RequestsTabContent";
import { TrainingTabContent } from "../components/features/TrainingTabContent";
import { AudioHub } from "../components/features/AudioHub";
import { FinancialTabContent } from "../components/features/FinancialTabContent";
import { AdministrativeTabContent } from "../components/features/AdministrativeTabContent";
import { useDashboardData } from "../hooks/useDashboardData";
import { useAuth } from "../context/AuthContext";

export const Dashboard = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'financial' | 'administrative' | 'polls' | 'requests' | 'training' | 'audio'>('administrative');

    const {
        financialData, loading, showIban, setShowIban, departmentInfo,
        openSection, toggleSection,
        selectedYear, setSelectedYear, adminData, currentYearRecord,
        expandedDetail, handleDetailClick, detailLoading, detailItems,
        leavesList, selectedLeave, setSelectedLeave
    } = useDashboardData(activeTab);

    // Handle initial tab from URL
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'audio') {
            setActiveTab('audio');
            searchParams.delete('tab');
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // Handle tab switching via custom events
    useEffect(() => {
        const handleSwitchTab = (e: any) => {
            if (e.detail?.tab === 'audio') {
                setActiveTab('audio');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
        window.addEventListener('switch_dashboard_tab', handleSwitchTab);
        
        const handleNavigateToRequests = () => {
            setActiveTab('requests');
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
            {(activeTab === 'financial' || activeTab === 'administrative') && (
                <YearSlider selectedYear={selectedYear} onYearChange={setSelectedYear} />
            )}
        </div>
    );

    return (
        <Layout headerContent={headerContent} headerTitle="لوحة الموظف" showUserName={true}>
            <AppNotifications />
            <div className="max-w-4xl mx-auto px-4 relative pb-20 min-h-[70vh] mt-6 bg-transparent">
                {activeTab === 'polls' ? (
                    <UserPolls />
                ) : activeTab === 'requests' ? (
                    <RequestsTabContent />
                ) : activeTab === 'training' ? (
                    <TrainingTabContent />
                ) : activeTab === 'audio' ? (
                    <AudioHub />
                ) : activeTab === 'financial' ? (
                    <FinancialTabContent 
                        user={user}
                        financialData={financialData}
                        loading={loading}
                        showIban={showIban}
                        setShowIban={setShowIban}
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
                        selectedYear={selectedYear}
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
