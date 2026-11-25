import { useState, lazy, Suspense } from 'react';
import { GraduationCap, BookOpen, Loader2, ClipboardCheck } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { isDeveloperLevel } from '../../../utils/permissions';
import { TrainingTabContent } from '../../../components/features/TrainingTabContent';

const AdminPromotionTab = lazy(() =>
    import('../../promotion/components/AdminPromotionTab').then(m => ({ default: m.AdminPromotionTab }))
);
const CurriculaTab = lazy(() =>
    import('../../promotion/components/CurriculaTab').then(m => ({ default: m.CurriculaTab }))
);
const ExamTab = lazy(() =>
    import('../../promotion/components/ExamTab').then(m => ({ default: m.ExamTab }))
);

interface TrainingAndPromotionHubProps {
    /** true عندما يُعرض داخل لوحة المشرف (بطاقة مشرف)، false عند عرضه في تبويبة المستخدم */
    isAdminDashboard?: boolean;
}

/**
 * تبويبة «تدريب ودورات» الموحدة والمستقلة (معزولة معمارياً)
 * تعرض زرين أفقيين متجاورين في سطر واحد (التدريب الصيفي يميناً | دورات الترفيع يساراً)
 * وتحتهما مساحة فارغة حتى يختار المستخدم أحدهما.
 */
export const TrainingAndPromotionHub = ({ isAdminDashboard = false }: TrainingAndPromotionHubProps) => {
    const { theme } = useTheme();
    const { user } = useAuth();
    const isDark = theme === 'dark';

    const [activeChoice, setActiveChoice] = useState<'training' | 'promotion' | null>(null);
    const [studentSubTab, setStudentSubTab] = useState<'curricula' | 'exam'>('curricula');

    const isDeveloperOrGeneral = Boolean(isDeveloperLevel(user?.admin_role) || user?.admin_role === 'general');
    const isAdminUser = user?.role === 'admin' || isDeveloperOrGeneral;

    // صلاحيات الظهور
    const canSeeTraining = Boolean(
        isAdminDashboard
            ? (isAdminUser || user?.is_training_supervisor === true)
            : (user?.is_training_supervisor === true)
    );
    const canSeePromotion = Boolean(
        isAdminDashboard
            ? (isAdminUser || user?.is_promotion_lecturer === true || user?.can_access_promotion === true)
            : (user?.can_access_promotion === true || user?.is_promotion_lecturer === true)
    );

    const isPromotionAdminOrLecturer = Boolean(
        isAdminDashboard || isDeveloperOrGeneral || user?.is_promotion_lecturer === true
    );

    return (
        <div className="max-w-5xl mx-auto px-2 sm:px-4 pb-2 space-y-5 animate-in fade-in duration-300 w-full">
            {/* شريط الزرين الأفقيين في سطر واحد */}
            <div className={cn(
                'grid gap-3',
                canSeeTraining && canSeePromotion ? 'grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'
            )}>
                {/* اليمين: زر التدريب الصيفي */}
                {canSeeTraining && (
                    <button
                        type="button"
                        onClick={() => setActiveChoice(prev => prev === 'training' ? null : 'training')}
                        className={cn(
                            'group relative flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border font-bold text-sm sm:text-base transition-all duration-300 active:scale-[0.98] shadow-sm',
                            activeChoice === 'training'
                                ? 'bg-gradient-to-l from-emerald-600 to-teal-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/25'
                                : isDark
                                    ? 'bg-slate-900/70 border-white/10 text-slate-200 hover:bg-slate-800/90 hover:border-emerald-500/40'
                                    : 'bg-white border-slate-200 text-slate-800 hover:bg-emerald-50/60 hover:border-emerald-300'
                        )}
                    >
                        <div className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                            activeChoice === 'training'
                                ? 'bg-white/20 text-white'
                                : isDark
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-emerald-50 text-emerald-600'
                        )}>
                            <GraduationCap className="w-5 h-5" />
                        </div>
                        <span className="truncate">التدريب الصيفي</span>
                    </button>
                )}

                {/* اليسار: زر دورات الترفيع */}
                {canSeePromotion && (
                    <button
                        type="button"
                        onClick={() => setActiveChoice(prev => prev === 'promotion' ? null : 'promotion')}
                        className={cn(
                            'group relative flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border font-bold text-sm sm:text-base transition-all duration-300 active:scale-[0.98] shadow-sm',
                            activeChoice === 'promotion'
                                ? 'bg-gradient-to-l from-amber-500 to-orange-500 text-white border-amber-400 shadow-lg shadow-amber-500/25'
                                : isDark
                                    ? 'bg-slate-900/70 border-white/10 text-slate-200 hover:bg-slate-800/90 hover:border-amber-500/40'
                                    : 'bg-white border-slate-200 text-slate-800 hover:bg-amber-50/60 hover:border-amber-300'
                        )}
                    >
                        <div className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                            activeChoice === 'promotion'
                                ? 'bg-white/20 text-white'
                                : isDark
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-amber-50 text-amber-600'
                        )}>
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <span className="truncate">دورات الترفيع</span>
                    </button>
                )}
            </div>

            {/* المحتوى يظهر فقط بعد اختيار أحد الزرين — وما تحتهما فراغ عند البداية */}
            {activeChoice === 'training' && (
                <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <TrainingTabContent isAdmin={isDeveloperOrGeneral || isAdminDashboard} />
                </div>
            )}

            {activeChoice === 'promotion' && (
                <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <Suspense
                        fallback={
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                            </div>
                        }
                    >
                        {isPromotionAdminOrLecturer ? (
                            <AdminPromotionTab isAdminView={isDeveloperOrGeneral || isAdminDashboard} />
                        ) : (
                            <div className="space-y-4">
                                {/* تبويبات الطالب في دورة الترفيع (المناهج / الاختبار) */}
                                <div className={cn(
                                    'flex rounded-xl p-1 gap-1 max-w-md mx-auto',
                                    isDark ? 'bg-white/5' : 'bg-slate-100'
                                )}>
                                    <button
                                        type="button"
                                        onClick={() => setStudentSubTab('curricula')}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all',
                                            studentSubTab === 'curricula'
                                                ? isDark
                                                    ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                                                    : 'bg-white text-amber-700 shadow-sm'
                                                : isDark
                                                    ? 'text-white/50 hover:text-white/70'
                                                    : 'text-slate-500 hover:text-slate-700'
                                        )}
                                    >
                                        <BookOpen className="w-4 h-4" />
                                        المناهج
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStudentSubTab('exam')}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all',
                                            studentSubTab === 'exam'
                                                ? isDark
                                                    ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                                                    : 'bg-white text-amber-700 shadow-sm'
                                                : isDark
                                                    ? 'text-white/50 hover:text-white/70'
                                                    : 'text-slate-500 hover:text-slate-700'
                                        )}
                                    >
                                        <ClipboardCheck className="w-4 h-4" />
                                        الاختبار
                                    </button>
                                </div>
                                {studentSubTab === 'curricula' ? <CurriculaTab /> : <ExamTab />}
                            </div>
                        )}
                    </Suspense>
                </div>
            )}
        </div>
    );
};
