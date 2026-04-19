import { useState } from 'react';
import { BookOpen, ClipboardCheck, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { CurriculaTab } from './components/CurriculaTab';
import { ExamTab } from './components/ExamTab';

interface PromotionCoursesPageProps {
    onBack: () => void;
}

/**
 * الصفحة الرئيسية لدورات الترفيع — واجهة الموظف
 * تحتوي تبويبتي: المناهج | الاختبار
 */
export const PromotionCoursesPage = ({ onBack }: PromotionCoursesPageProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [activeTab, setActiveTab] = useState<'curricula' | 'exam'>('curricula');

    const tabs = [
        { id: 'curricula' as const, label: 'المناهج', icon: BookOpen },
        { id: 'exam' as const, label: 'الاختبار', icon: ClipboardCheck },
    ];

    return (
        <div className={cn(
            "min-h-screen transition-colors",
            isDark
                ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
                : "bg-gradient-to-b from-slate-50 via-white to-slate-50"
        )}>
            {/* Header */}
            <div className={cn(
                "sticky top-0 z-20 backdrop-blur-xl border-b",
                isDark ? "bg-slate-900/80 border-white/10" : "bg-white/80 border-slate-200"
            )}>
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={onBack}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-95",
                                isDark ? "text-white/70 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                            )}
                        >
                            <ArrowRight className="w-4 h-4" />
                            رجوع
                        </button>
                        <h1 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800")}>
                            دورات الترفيع
                        </h1>
                        <div className="w-20" /> {/* Spacer for centering */}
                    </div>

                    {/* Tab Navigation */}
                    <div className={cn(
                        "flex rounded-xl p-1 gap-1",
                        isDark ? "bg-white/5" : "bg-slate-100"
                    )}>
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-300",
                                        isActive
                                            ? isDark
                                                ? "bg-amber-500/20 text-amber-300 shadow-sm"
                                                : "bg-white text-amber-700 shadow-sm"
                                            : isDark
                                                ? "text-white/50 hover:text-white/70"
                                                : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {activeTab === 'curricula' ? <CurriculaTab /> : <ExamTab />}
            </div>
        </div>
    );
};
