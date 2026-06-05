import { useState } from 'react';
import { GraduationCap, LogIn, Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useTrainingData } from '../hooks/useTrainingData';
import type { TrainingStudent } from '../types';
import { TraineeExamTab } from './TraineeExamTab';

/**
 * صفحة تسجيل دخول المتدربين في التدريب الصيفي
 */
export const TraineeLoginPage = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { authenticateTrainee } = useTrainingData();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [loggedInStudent, setLoggedInStudent] = useState<TrainingStudent | null>(null);

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            setError('يرجى إدخال اسم المستخدم وكلمة المرور');
            return;
        }

        setLoading(true);
        setError('');

        const student = await authenticateTrainee(username.trim(), password);
        setLoading(false);

        if (student) {
            setLoggedInStudent(student);
        } else {
            setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleLogin();
    };

    // إذا تم تسجيل الدخول بنجاح، أظهر واجهة الاختبار
    if (loggedInStudent) {
        return (
            <TraineeExamTab
                student={loggedInStudent}
                onLogout={() => setLoggedInStudent(null)}
            />
        );
    }

    return (
        <div className={cn(
            "min-h-screen flex items-center justify-center px-4 py-8",
            isDark
                ? "bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-950"
                : "bg-gradient-to-br from-emerald-50 via-white to-teal-50"
        )}>
            <div className={cn(
                "w-full max-w-md rounded-3xl border p-8 space-y-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500",
                isDark
                    ? "bg-slate-900/80 border-white/10 shadow-emerald-500/5"
                    : "bg-white/90 border-slate-200 shadow-emerald-500/10"
            )}>
                {/* Header */}
                <div className="text-center space-y-3">
                    <div className={cn(
                        "w-16 h-16 rounded-2xl mx-auto flex items-center justify-center",
                        "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30"
                    )}>
                        <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                    <h1 className={cn("text-xl font-black", isDark ? "text-white" : "text-slate-900")}>
                        التدريب الصيفي
                    </h1>
                    <p className={cn("text-sm", isDark ? "text-white/50" : "text-slate-500")}>
                        تسجيل دخول المتدربين
                    </p>
                </div>

                {/* Form */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className={cn("text-sm font-bold block", isDark ? "text-white/70" : "text-slate-600")}>
                            اسم المستخدم
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="أدخل اسم المستخدم"
                            dir="ltr"
                            className={cn(
                                "w-full h-12 px-4 rounded-xl border text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-emerald-500/50",
                                isDark
                                    ? "bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                    : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={cn("text-sm font-bold block", isDark ? "text-white/70" : "text-slate-600")}>
                            كلمة المرور
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="أدخل كلمة المرور"
                                dir="ltr"
                                className={cn(
                                    "w-full h-12 px-12 rounded-xl border text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-emerald-500/50 text-center tracking-widest",
                                    isDark
                                        ? "bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                        : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
                                )}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(prev => !prev)}
                                className={cn(
                                    "absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors",
                                    isDark ? "text-white/40 hover:text-white/70" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold text-center animate-in fade-in duration-200">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className={cn(
                            "w-full h-12 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2",
                            "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                        )}
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <LogIn className="w-4 h-4" />
                                تسجيل الدخول
                            </>
                        )}
                    </button>
                </div>

                {/* Footer */}
                <p className={cn("text-center text-xs", isDark ? "text-white/30" : "text-slate-400")}>
                    اتصالات ومعلوماتية كربلاء المقدسة
                </p>
            </div>
        </div>
    );
};
