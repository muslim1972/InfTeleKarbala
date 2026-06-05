import { ArrowRight, ShieldAlert, BookOpen } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { TrainingTabContent } from '../../../components/features/TrainingTabContent';

interface SummerTrainingPageProps {
    onBack: () => void;
}

export const SummerTrainingPage = ({ onBack }: SummerTrainingPageProps) => {
    const { theme } = useTheme();
    const { user } = useAuth();
    const isDark = theme === 'dark';
    const isSupervisor = user?.is_training_supervisor === true || user?.role === 'admin' || user?.admin_role === 'developer' || user?.admin_role === 'general';

    return (
        <div className={cn(
            "h-screen flex flex-col transition-colors overflow-hidden",
            isDark
                ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
                : "bg-gradient-to-b from-slate-50 via-white to-slate-50"
        )}>
            {/* Header - Fixed at Top */}
            <div className={cn(
                "flex-none backdrop-blur-xl border-b z-50 relative",
                isDark ? "bg-slate-900/80 border-white/10" : "bg-white/80 border-slate-200"
            )}>
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
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
                        <h1 className={cn("text-lg font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-800")}>
                            {isSupervisor ? (
                                <ShieldAlert className="w-5 h-5 text-emerald-500 animate-pulse" />
                            ) : (
                                <BookOpen className="w-5 h-5 text-emerald-500" />
                            )}
                            {isSupervisor ? 'إدارة التدريب الصيفي' : 'التدريب الصيفي'}
                        </h1>
                        <div className="w-20" /> {/* Spacer for centering */}
                    </div>
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto">
                <div className="py-6">
                    <TrainingTabContent isAdmin={isSupervisor} />
                </div>
            </div>
        </div>
    );
};
