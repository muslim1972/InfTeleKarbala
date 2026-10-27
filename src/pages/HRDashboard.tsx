import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { useTheme } from '../context/ThemeContext';
import { HRRequestsHub } from '../features/hr/components/HRRequestsHub';
import { HROutgoingMail } from '../features/hr/components/HROutgoingMail';
import { HRIncomingMail } from '../features/hr/components/HRIncomingMail';
import { HREmployeeDossiers } from '../features/hr/components/HREmployeeDossiers';
import { HRAdminOrders } from '../features/hr/components/HRAdminOrders';
import { HROverview } from '../features/hr/components/HROverview';
import type { HRTabType } from '../features/hr/types';

interface HRDashboardProps {
    onBack?: () => void;
}

export const HRDashboard = ({ onBack }: HRDashboardProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [activeTab, setActiveTab] = useState<HRTabType>(() => {
        const urlTab = new URLSearchParams(window.location.search).get('hr_tab') as HRTabType;
        if (urlTab && ['requests', 'outgoing', 'incoming', 'dossiers', 'orders', 'overview'].includes(urlTab)) {
            return urlTab;
        }
        return 'requests';
    });

    const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);

    // Listen to notification navigation event if any
    useEffect(() => {
        const handleNotificationNavigation = (e: any) => {
            setActiveTab('requests');
            if (e.detail?.requestId) setHighlightRequestId(e.detail.requestId);
        };
        window.addEventListener('navigate_to_hr_requests', handleNotificationNavigation);
        return () => window.removeEventListener('navigate_to_hr_requests', handleNotificationNavigation);
    }, []);

    // Scroll to top on tab change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [activeTab]);

    const tabs: { id: HRTabType; label: string }[] = [
        { id: 'requests', label: 'الطلبات والموافقات' },
        { id: 'outgoing', label: 'الكتب الصادرة' },
        { id: 'incoming', label: 'الكتب الواردة' },
        { id: 'dossiers', label: 'الإضبارات الإلكترونية' },
        { id: 'orders', label: 'الأوامر الإدارية' },
        { id: 'overview', label: 'لوحة المؤشرات' }
    ];

    const hrHeaderContent = (
        <div className="space-y-3 w-full">
            {/* Scrollable Tabs */}
            <div className={`flex p-1 rounded-xl border shadow-inner w-full ${
                isDark ? 'bg-black/40 border-white/5' : 'bg-white border-gray-100'
            } backdrop-blur-md overflow-hidden`}>
                <ScrollableTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as HRTabType)}
                    containerClassName="w-full"
                    activeTabClassName="bg-rose-600 text-white shadow-lg"
                    inactiveTabClassName={isDark ? "text-white/50 hover:text-white" : "text-gray-600 hover:text-black"}
                />
            </div>

            {/* Quick Status Ribbon */}
            <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-foreground">
                        شعبة الموارد البشرية
                    </span>
                    <span className="text-muted-foreground hidden sm:inline">
                        • نظام الإدارة الموحد
                    </span>
                </div>
                <div className="text-muted-foreground font-medium">
                    السنة الإدارية: 2026
                </div>
            </div>
        </div>
    );

    return (
        <Layout
            headerTitle="الموارد البشرية"
            showUserName={true}
            headerContent={hrHeaderContent}
            className="relative min-h-screen bg-transparent"
            onBack={onBack}
        >
            <div className="max-w-6xl mx-auto px-2 sm:px-4 relative pb-24 mt-2">
                {activeTab === 'requests' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                        <HRRequestsHub highlightRequestId={highlightRequestId} />
                    </div>
                )}

                {activeTab === 'outgoing' && (
                    <HROutgoingMail />
                )}

                {activeTab === 'incoming' && (
                    <HRIncomingMail />
                )}

                {activeTab === 'dossiers' && (
                    <HREmployeeDossiers />
                )}

                {activeTab === 'orders' && (
                    <HRAdminOrders />
                )}

                {activeTab === 'overview' && (
                    <HROverview onNavigateTab={(tab) => setActiveTab(tab)} />
                )}
            </div>
        </Layout>
    );
};
