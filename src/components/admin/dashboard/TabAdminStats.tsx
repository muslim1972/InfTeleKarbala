import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Users, 
    Activity, 
    TrendingUp, 
    Loader2,
    AlertCircle,
    CalendarDays,
    Printer,
    Award
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import { GlassCard } from '../../ui/GlassCard';
import { ActiveVisitorsModal } from './ActiveVisitorsModal';

interface StatsData {
    gender_dist: Record<string, number>;
    birth_year_dist: Record<string, number>;
    appointment_year_dist: Record<string, number>;
    login_activity: { date: string; count: number }[];
    retired_count?: number;
}

export const TabAdminStats = ({ theme }: { theme: 'light' | 'dark' }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<StatsData | null>(null);
    const [showVisitorsModal, setShowVisitorsModal] = useState(false);
    const [printingUnspecified, setPrintingUnspecified] = useState(false);

    const currentGov = sessionStorage.getItem('selectedGovernorate') || 'karbala';
    const govNameAr = currentGov === 'babil' ? 'بابل' : currentGov === 'najaf' ? 'النجف الأشرف' : 'كربلاء المقدسة';

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const { data, error: rpcError } = await supabase.rpc('get_admin_stats_v1', {
                p_governorate: currentGov
            });

            if (rpcError) throw rpcError;
            setStats(data);
        } catch (err: any) {
            console.error('Stats fetch error:', err);
            setError(err.message || 'فشل تحميل البيانات الإحصائية');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [currentGov]);

    const handlePrintUnspecified = async () => {
        try {
            setPrintingUnspecified(true);
            const { data, error: rpcErr } = await supabase.rpc('get_unspecified_gender_profiles', {
                p_governorate: currentGov
            });

            if (rpcErr) throw rpcErr;

            const profilesList: any[] = data?.profiles || [];
            const rowsHtml = profilesList.map((p, idx) => {
                let lastLoginFormatted = '';
                if (p.last_login_at) {
                    const d = new Date(p.last_login_at);
                    const dStr = d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' });
                    const tStr = d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
                    lastLoginFormatted = `
                        <div style="font-weight: 700; font-family: monospace; font-size: 12px; color: #0f172a;">${dStr}</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${tStr}</div>
                    `;
                }

                return `
                    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
                        <td style="padding: 10px 8px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
                        <td style="padding: 10px 8px; font-weight: 700; color: #1e293b;">${p.full_name}</td>
                        <td style="padding: 10px 8px; color: #334155;">${p.workplace || 'مديرية الاتصالات'}</td>
                        <td style="padding: 10px 8px; text-align: center;">
                            ${lastLoginFormatted || '<span style="color: #94a3b8; font-size: 12px;">—</span>'}
                        </td>
                        <td style="padding: 10px 8px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; width: 140px;">
                            <span style="font-size: 11px;">[ &nbsp; ] ذكر &nbsp;&nbsp; [ &nbsp; ] أنثى</span>
                        </td>
                    </tr>
                `;
            }).join('');

            const htmlContent = `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="utf-8" />
                    <title>قائمة الموظفين غير محددي الجنس - مديرية اتصالات ${govNameAr}</title>
                    <style>
                        @page { size: A4 portrait; margin: 15mm; }
                        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 10px; direction: rtl; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
                        .header-text h2 { margin: 0 0 4px 0; font-size: 16px; color: #0f172a; }
                        .header-text h3 { margin: 0; font-size: 14px; color: #0284c7; }
                        .doc-info { text-align: left; font-size: 12px; color: #64748b; }
                        .title-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
                        .title-box h1 { margin: 0; font-size: 15px; color: #1e293b; }
                        .badge { background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 13px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { background: #0f172a; color: #fff; padding: 9px 8px; font-size: 13px; font-weight: 700; text-align: right; }
                        th.center { text-align: center; }
                        .footer { margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 10px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="header-text">
                            <h2>جمهورية العراق - وزارة الاتصالات</h2>
                            <h3>الشركة العامة للاتصالات والمعلوماتية - مديرية اتصالات ${govNameAr}</h3>
                        </div>
                        <div class="doc-info">
                            <div>شعبة الموارد البشرية</div>
                            <div>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-IQ')}</div>
                        </div>
                    </div>

                    <div class="title-box">
                        <div>
                            <h1>قائمة الموظفين غير محددي الجنس (للتدقيق واستكمال الأضابير)</h1>
                            <div style="font-size: 12px; color: #64748b; margin-top: 3px;">
                                يُرجى من لجان الموارد البشرية تدقيق القيود وتثبيت الجنس حسب الأضابير الشخصية
                            </div>
                        </div>
                        <div class="badge">
                            العدد الإجمالي: ${profilesList.length} موظفاً
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 45px;" class="center">ت</th>
                                <th>اسم الموظف</th>
                                <th>مكان العمل</th>
                                <th style="width: 140px;" class="center">آخر دخول للتطبيق</th>
                                <th style="width: 140px;" class="center">تدقيق الموارد البشرية</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <div class="footer">
                        <div>توقيع وتدقيق مسؤول الموارد البشرية: ..............................</div>
                        <div>نظام الإدارة الموحد</div>
                    </div>
                </body>
                </html>
            `;

            const printIframe = document.createElement('iframe');
            printIframe.style.position = 'fixed';
            printIframe.style.right = '0';
            printIframe.style.bottom = '0';
            printIframe.style.width = '0';
            printIframe.style.height = '0';
            printIframe.style.border = '0';
            document.body.appendChild(printIframe);

            const iframeDoc = printIframe.contentWindow?.document;
            if (!iframeDoc) return;

            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();

            printIframe.contentWindow?.addEventListener('afterprint', () => {
                printIframe.remove();
            });

            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
        } catch (err: any) {
            console.error('Print unspecified error:', err);
            alert('فشل استخراج قائمة غير المحدد: ' + (err.message || 'خطأ غير معروف'));
        } finally {
            setPrintingUnspecified(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <p className={cn("text-sm", theme === 'light' ? "text-gray-500" : "text-white/40")}>جاري تحليل البيانات...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-red-500">
                <AlertCircle className="w-12 h-12" />
                <p className="font-bold">{error}</p>
                <button 
                    onClick={fetchStats}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all"
                >
                    إعادة المحاولة
                </button>
            </div>
        );
    }

    const totalEmployees = stats?.gender_dist ? Object.values(stats.gender_dist).reduce((a, b) => a + b, 0) : 0;
    const maleCount = stats?.gender_dist?.['male'] || 0;
    const femaleCount = stats?.gender_dist?.['female'] || 0;
    const unspecifiedCount = stats?.gender_dist?.['unspecified'] || 0;
    const todayLogins = stats?.login_activity?.slice(-1)[0]?.count || 0;

    const malePct = totalEmployees > 0 ? (maleCount / totalEmployees) * 100 : 0;
    const femalePct = totalEmployees > 0 ? (femaleCount / totalEmployees) * 100 : 0;
    const unspecifiedPct = totalEmployees > 0 ? (unspecifiedCount / totalEmployees) * 100 : 0;

    return (
        <div className="max-w-7xl mx-auto px-2 sm:px-4 pt-1 sm:pt-2 pb-6 space-y-4 sm:space-y-6 animate-in fade-in duration-500">
            {/* Snapshot Header */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
                <StatSummaryCard 
                    title="الموظفون بالخدمة" 
                    value={totalEmployees} 
                    icon={Users} 
                    color="blue"
                    theme={theme}
                />
                <StatSummaryCard 
                    title="سجل المتقاعدين" 
                    value={stats?.retired_count || 0} 
                    icon={Award} 
                    color="amber"
                    theme={theme}
                />
                <StatSummaryCard 
                    title="نشاط اليوم" 
                    value={`${todayLogins} دخول`} 
                    icon={Activity} 
                    color="green"
                    theme={theme}
                    clickable
                    onClick={() => setShowVisitorsModal(true)}
                />
                <StatSummaryCard 
                    title="مواليد هذا العام" 
                    value={stats?.birth_year_dist?.[new Date().getFullYear().toString()] || 0} 
                    icon={CalendarDays} 
                    color="purple"
                    theme={theme}
                />
                <div className="col-span-2 lg:col-span-1">
                    <StatSummaryCard 
                        title="التعيينات الجديدة" 
                        value={stats?.appointment_year_dist?.[new Date().getFullYear().toString()] || 0} 
                        icon={TrendingUp} 
                        color="amber"
                        theme={theme}
                    />
                </div>
            </div>

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gender Distribution Card */}
                <GlassCard className="p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500 opacity-70" />
                            <h3 className={cn("font-bold text-base sm:text-lg", theme === 'light' ? "text-gray-900" : "text-white")}>
                                توزيع النوع الاجتماعي
                            </h3>
                        </div>

                        {/* زر طباعة غير المحدد في الركن الأيسر الأعلى */}
                        <button
                            onClick={handlePrintUnspecified}
                            disabled={printingUnspecified}
                            title="طباعة قائمة الموظفين غير محددي الجنس لإحالتها إلى الموارد البشرية"
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm active:scale-95",
                                theme === 'light'
                                    ? "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300"
                                    : "bg-white/10 hover:bg-white/15 text-white/90 border-white/10"
                            )}
                        >
                            {printingUnspecified ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            ) : (
                                <Printer className="w-3.5 h-3.5 text-blue-500" />
                            )}
                            <span>طباعة غير المحدد ({unspecifiedCount})</span>
                        </button>
                    </div>

                    <div className="flex flex-col items-center justify-center py-2">
                        {/* Interactive Dynamic Donut Chart */}
                        <div className="relative flex flex-col items-center">
                            <DonutChart 
                                data={[
                                    { label: 'ذكور', value: maleCount, color: '#3B82F6', percentage: malePct },
                                    { label: 'إناث', value: femaleCount, color: '#EC4899', percentage: femalePct },
                                    { label: 'غير محدد', value: unspecifiedCount, color: '#94A3B8', percentage: unspecifiedPct }
                                ]}
                                total={totalEmployees}
                                theme={theme}
                            />
                            {/* Badges showing percentages and counts in a single compact row */}
                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4 text-xs font-bold">
                                <span className="text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">
                                    ذكور {malePct.toFixed(0)}% = {maleCount}
                                </span>
                                <span className="text-pink-500 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">
                                    إناث {femalePct.toFixed(0)}% = {femaleCount}
                                </span>
                                <span className="text-gray-500 bg-gray-500/10 border border-gray-500/20 px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">
                                    غير محدد {unspecifiedPct.toFixed(0)}% = {unspecifiedCount}
                                </span>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* Appointment Years */}
                <GlassCard className="p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-amber-500 opacity-70" />
                            <h3 className={cn("font-bold text-base sm:text-lg", theme === 'light' ? "text-gray-900" : "text-white")}>
                                توزيع التعيينات حسب السنوات
                            </h3>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {Object.entries(stats?.appointment_year_dist || {})
                            .sort((a, b) => b[0].localeCompare(a[0]))
                            .slice(0, 5)
                            .map(([year, count]) => (
                                <div key={year} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className={theme === 'light' ? "text-gray-600" : "text-white/60"}>{year}</span>
                                        <span className="font-bold text-amber-500">{count} موظف</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(count / Math.max(...Object.values(stats?.appointment_year_dist || {}), 1)) * 100}%` }}
                                            className="h-full bg-amber-500 rounded-full"
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </GlassCard>
            </div>

                        {/* Active Visitors Modal */}
            <ActiveVisitorsModal
                isOpen={showVisitorsModal}
                onClose={() => setShowVisitorsModal(false)}
                theme={theme}
                governorate={currentGov}
            />
        </div>
    );
};

interface StatSummaryCardProps {
    title: string;
    value: string | number;
    icon: any;
    color: 'blue' | 'green' | 'purple' | 'amber';
    theme: 'light' | 'dark';
    clickable?: boolean;
    onClick?: () => void;
}

const StatSummaryCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    theme, 
    clickable, 
    onClick 
}: StatSummaryCardProps) => {
    const colors = {
        blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        green: "text-green-500 bg-green-500/10 border-green-500/20",
        purple: "text-purple-500 bg-purple-500/10 border-purple-500/20",
        amber: "text-amber-500 bg-amber-500/10 border-amber-500/20"
    };

    return (
        <GlassCard 
            onClick={clickable ? onClick : undefined}
            className={cn(
                "p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4 transition-all duration-200 select-none",
                clickable && "cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:border-green-500/40 hover:shadow-lg"
            )}
        >
            <div className={cn("w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border", colors[color])}>
                <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                    <p className={cn("text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider opacity-60 truncate", theme === 'light' ? "text-gray-900" : "text-white")}>
                        {title}
                    </p>
                    {clickable && (
                        <span className="text-[8px] sm:text-[9px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                            تصفية
                        </span>
                    )}
                </div>
                <p className={cn("text-lg sm:text-2xl font-black truncate", theme === 'light' ? "text-gray-900" : "text-white")}>
                    {value}
                </p>
            </div>
        </GlassCard>
    );
};

const DonutChart = ({ data, total, theme }: any) => {
    let currentAngle = 0;
    return (
        <div className="relative w-36 h-36">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                {data.map((item: any, i: number) => {
                    const percentage = total > 0 ? (item.value / total) * 100 : 0;
                    const strokeDasharray = `${percentage} ${100 - percentage}`;
                    const strokeDashoffset = -currentAngle;
                    currentAngle += percentage;
                    return (
                        <circle
                            key={i}
                            cx="18" cy="18" r="15.915"
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth="3.8"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-1000 ease-out"
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-2xl font-black", theme === 'light' ? "text-gray-900" : "text-white")}>
                    {total}
                </span>
                <span className="text-[9px] opacity-60 uppercase font-bold tracking-wider">
                    إجمالي
                </span>
            </div>
        </div>
    );
};
