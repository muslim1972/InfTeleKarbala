import { useState, useEffect } from "react";
import { User, Power, Settings, Sun, Moon, History, MapPin } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useAuth } from "../../context/AuthContext";
import { useSnapshots } from "../../context/SnapshotContext";
import { useGovernorate } from "../../context/GovernorateContext";
import { SettingsModal } from "../features/SettingsModal";
import { SnapshotBrowser } from "../snapshots/SnapshotBrowser";
import { HeaderMenu } from "./HeaderMenu";
import { useTheme } from "../../context/ThemeContext";
import { useAccessibility, type FontScale } from "../../context/AccessibilityContext";
import { getRoleLabel } from "../../utils/formatRoles";
import { toast } from "react-hot-toast";

interface AppHeaderProps {
    bottomContent?: React.ReactNode;
    title?: string;
    showUserName?: boolean; // Show user name next to avatar
    onBack?: () => void; // Optional back navigation callback
}

const SCALE_CYCLE_LABEL: Record<FontScale, string> = {
    xsmall: 'صغير جداً (80%)',
    small: 'صغير (90%)',
    normal: 'افتراضي (100%)',
    medium: 'متوسط (112%)',
    large: 'كبير (125%)',
    xlarge: 'كبير جداً (138%)'
};

export const AppHeader = ({ bottomContent, title, showUserName = false, onBack }: AppHeaderProps) => {
    const { user, logout } = useAuth();
    const { activeSnapshot } = useSnapshots();
    const { activeGovernorate, setActiveGovernorate, canChangeGovernorate, availableGovernorates } = useGovernorate();
    const { theme, toggleTheme } = useTheme();
    const { fontScale, cycleFontScale, currentOption } = useAccessibility();
    const [showSettings, setShowSettings] = useState(false);
    const [showSnapshots, setShowSnapshots] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);

    // إعادة محاولة الصورة عند تغيّر رابط الأفاتار
    useEffect(() => { setAvatarFailed(false); }, [user?.avatar_url]);

    if (!user) return null;

    const handleCycleFontScale = () => {
        const next = cycleFontScale();
        toast.success(`حجم الخط: ${SCALE_CYCLE_LABEL[next]}`, { id: 'font-scale-toast', duration: 1500 });
    };

    return (
        <>
            <header className="sticky top-0 z-[60] px-2 w-full pt-[max(env(safe-area-inset-top),0.5rem)] pb-1">
                <GlassCard className={`flex flex-col p-2 !rounded-2xl backdrop-blur-xl transition-colors duration-300 !overflow-visible ${theme === 'light'
                    ? 'bg-brand-cream/80 border-gray-200/50 shadow-sm'
                    : '!bg-[#0f172a]/80 !border-white/10'
                    }`}>
                    <div className="flex items-center justify-between w-full gap-2">
                        {/* Right: Avatar + User Name + Developer Governorate Switcher */}
                        <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                            <button
                                onClick={() => setShowSettings(true)}
                                className="flex items-center gap-2 hover:bg-white/5 p-1 rounded-lg transition-colors group shrink-0"
                            >
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-yellow to-brand-green flex items-center justify-center shadow-lg border-2 border-white/20 overflow-hidden relative shrink-0">
                                    {/* أيقونة الاحتياط — تظهر خلف الصورة وفور فشل تحميلها */}
                                    <User className="absolute inset-0 m-auto w-4 h-4 text-white" />
                                    {user.avatar_url && !avatarFailed && (
                                        <img
                                            src={user.avatar_url}
                                            alt="User"
                                            onError={() => setAvatarFailed(true)}
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                    )}

                                    {/* Hover overlay hint */}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <Settings className="w-3 h-3 text-white" />
                                    </div>
                                </div>
                                {showUserName && (
                                    <div className="text-right min-w-0">
                                        <h2 className={`font-bold text-sm font-tajawal group-hover:text-brand-yellow transition-colors truncate max-w-[110px] sm:max-w-[160px] ${theme === 'light' ? 'text-gray-900' : 'text-white'
                                            }`}>
                                            {user?.full_name ? user.full_name.split(' ').slice(0, 2).join(' ') : 'زائر'}
                                        </h2>
                                        <p className={`text-[10px] font-cairo font-bold truncate max-w-[110px] sm:max-w-[160px] ${theme === 'light' ? 'text-brand-green' : 'text-brand-yellow'
                                            }`}>
                                            {title || getRoleLabel(user)}
                                        </p>
                                    </div>
                                )}
                            </button>

                            {/* تبديل المحافظة - متاح حصرياً لحساب المطور (مسلم عقيل) */}
                            {canChangeGovernorate && (
                                <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl border transition-all shadow-sm ${
                                    theme === 'light'
                                        ? 'bg-white/90 border-gray-200 text-gray-800 shadow-sm'
                                        : 'bg-white/10 border-white/10 text-white'
                                }`}>
                                    <MapPin className="w-3.5 h-3.5 text-brand-green dark:text-brand-yellow shrink-0" />
                                    <select
                                        value={activeGovernorate}
                                        onChange={(e) => {
                                            const nextGov = e.target.value;
                                            setActiveGovernorate(nextGov);
                                            const found = availableGovernorates.find(g => g.id === nextGov);
                                            toast.success(`المحافظة النشطة: ${found?.name || nextGov}`, {
                                                id: 'gov-change-toast',
                                                duration: 1500,
                                                icon: '📍'
                                            });
                                        }}
                                        className={`bg-transparent text-xs font-bold font-tajawal outline-none cursor-pointer border-none py-0.5 max-w-[130px] truncate ${
                                            theme === 'light' ? 'text-gray-800' : 'text-white'
                                        }`}
                                        title="تبديل المحافظة النشطة (صلاحية المطور)"
                                    >
                                        {availableGovernorates.map((g) => (
                                            <option
                                                key={g.id}
                                                value={g.id}
                                                className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-xs font-tajawal"
                                            >
                                                {g.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Left: Toggles (sm+) + Back/Logout + Kebab Menu (mobile) */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            {/* ── أدوات سريعة inline — تظهر على الشاشات المتوسطة فأعلى ── */}
                            <div className="hidden sm:flex items-center gap-2">
                                {/* Font Zoom Quick Button (تكبير + تصغير في دورة واحدة) */}
                                <button
                                    onClick={handleCycleFontScale}
                                    className={`flex items-center justify-center h-8 px-2.5 rounded-full transition-all duration-300 group border text-xs font-bold font-tajawal gap-1 shadow-sm active:scale-95 ${
                                        fontScale !== 'normal'
                                            ? 'bg-brand-green/20 text-brand-green border-brand-green/50 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                                            : theme === 'light'
                                            ? 'bg-white/90 text-gray-700 border-gray-200 hover:bg-gray-100'
                                            : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20'
                                    }`}
                                    title={`حجم الخط الحالي: ${currentOption.label} (${currentOption.percentage}) — انقر للتنقل بين كل المقاسات (تصغير 80% حتى تكبير 138%)`}
                                >
                                    <span className="text-[12px] font-black">A</span>
                                    <span className="text-[10px] opacity-75 font-mono">
                                        {currentOption.percentage}
                                    </span>
                                </button>

                                {/* Monthly Snapshots Browser + اسم النسخة المعروضة */}
                                <button
                                    onClick={() => setShowSnapshots(true)}
                                    className={`flex items-center justify-center gap-1.5 h-8 rounded-full transition-all duration-300 border ${
                                        activeSnapshot ? 'w-auto px-3' : 'w-8'
                                    } ${
                                        theme === 'light'
                                        ? 'bg-white/90 text-gray-700 border-gray-200 hover:bg-gray-100'
                                        : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20'
                                    }`}
                                    title={activeSnapshot ? `النسخة المعروضة حالياً: ${activeSnapshot.name} — انقر لتغيير النسخة` : 'النسخ الشهرية - عرض بيانات نسخة سابقة'}
                                >
                                    <History className="w-4 h-4 shrink-0" />
                                    {activeSnapshot && (
                                        <span className={`text-[11px] font-bold font-tajawal max-w-[150px] truncate ${theme === 'light' ? 'text-brand-green' : 'text-brand-yellow'}`}>
                                            {activeSnapshot.name}
                                        </span>
                                    )}
                                </button>

                                {/* Theme Toggle */}
                                <button
                                    onClick={toggleTheme}
                                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 group border relative overflow-hidden ${theme === 'light'
                                        ? 'bg-black border-black/10' // Light Mode -> Show Moon in Black Circle
                                        : 'bg-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.3)]' // Dark Mode -> Show Sun in White Circle
                                        }`}
                                    title={theme === 'dark' ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
                                >
                                    {/* Icon Rotation & Scale Transition */}
                                    <div className="relative flex items-center justify-center">
                                        {theme === 'dark' ? (
                                            // Sun Icon (Glowing Yellow)
                                            <Sun className="w-5 h-5 text-yellow-500 fill-yellow-500 animate-in fade-in zoom-in duration-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                                        ) : (
                                            // Moon Icon (White)
                                            <Moon className="w-4 h-4 text-white fill-white animate-in fade-in zoom-in duration-300" />
                                        )}
                                    </div>
                                </button>
                            </div>

                            {/* رجوع — يظهر إذا كان التنقل الخلفي متاحاً */}
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className={`px-3 h-8 rounded-full text-sm font-bold font-tajawal transition-all hover:scale-105 active:scale-95 ${
                                        theme === 'light' 
                                        ? 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200' 
                                        : 'text-white/70 hover:text-white bg-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    رجوع
                                </button>
                            )}

                            {/* تسجيل الخروج — متاح دائماً ومستقل في الشريط العلوي */}
                            <button
                                onClick={() => {
                                    if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
                                        logout();
                                    }
                                }}
                                className="p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 transition-colors border border-red-500/20 active:scale-95"
                                title="تسجيل الخروج"
                            >
                                <Power className="w-4 h-4" />
                            </button>

                            {/* ⋮ قائمة الخيارات — على الموبايل فقط (الثيم + حجم الخط + النسخ) */}
                            <div className="sm:hidden">
                                <HeaderMenu />
                            </div>
                        </div>
                    </div>

                    {bottomContent && (
                        <div className="mt-1 pt-1 border-t border-white/10 w-full animate-in fade-in slide-in-from-top-1 duration-200 overflow-visible relative">
                            {bottomContent}
                        </div>
                    )}
                </GlassCard>
            </header >

            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
            <SnapshotBrowser isOpen={showSnapshots} onClose={() => setShowSnapshots(false)} />
        </>
    );
};
