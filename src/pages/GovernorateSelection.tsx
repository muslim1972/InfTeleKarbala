import { useTheme } from "../context/ThemeContext";
import { ThemeToggleFloating } from "../components/ui/ThemeToggleFloating";
import toast from "react-hot-toast";

interface Governorate {
    id: string;
    name: string;
    isActive: boolean;
    icon?: string;
}

const governorates: Governorate[] = [
    { id: 'baghdad', name: 'بغداد', isActive: false },
    { id: 'karbala', name: 'كربلاء المقدسة', isActive: true },
    { id: 'najaf', name: 'النجف الأشرف', isActive: false },
    { id: 'basra', name: 'البصرة', isActive: false },
    { id: 'nineveh', name: 'نينوى', isActive: false },
    { id: 'babil', name: 'بابل', isActive: false },
    { id: 'dhi_qar', name: 'ذي قار', isActive: false },
    { id: 'maysan', name: 'ميسان', isActive: false },
    { id: 'wasit', name: 'واسط', isActive: false },
    { id: 'muthanna', name: 'المثنى', isActive: false },
    { id: 'qadisiyyah', name: 'القادسية', isActive: false },
    { id: 'diyala', name: 'ديالى', isActive: false },
    { id: 'anbar', name: 'الأنبار', isActive: false },
    { id: 'kirkuk', name: 'كركوك', isActive: false },
    { id: 'salah_al_din', name: 'صلاح الدين', isActive: false },
];

interface GovernorateSelectionProps {
    onSelect: () => void;
}

export const GovernorateSelection = ({ onSelect }: GovernorateSelectionProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const handleSelect = (gov: Governorate) => {
        if (gov.isActive) {
            sessionStorage.setItem('selectedGovernorate', gov.id);
            onSelect();
        } else {
            toast.error("ستضاف قريبا ان شاء الله", {
                icon: '⏳',
                style: {
                    borderRadius: '10px',
                    background: isDark ? '#333' : '#fff',
                    color: isDark ? '#fff' : '#333',
                },
            });
        }
    };

    return (
        <div className={`min-h-screen w-full flex flex-col relative overflow-y-auto overflow-x-hidden font-tajawal scroll-smooth transition-colors duration-500 ${
            isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`} dir="rtl">
            <ThemeToggleFloating />

            {/* Animated Background */}
            <div className={`fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-in-out scale-105 ${
                isDark ? 'opacity-40' : 'opacity-20'
            }`} style={{ backgroundImage: `url('/sign-in.jpg')` }}></div>

            <div className={`fixed inset-0 z-0 backdrop-blur-md transition-colors duration-700 ${
                isDark ? 'bg-slate-950/80' : 'bg-white/80'
            }`}></div>

            {/* Glowing Orbs */}
            <div className={`fixed top-0 right-0 w-96 h-96 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000 ${
                isDark ? 'bg-emerald-500/20' : 'bg-emerald-200/40'
            }`}></div>
            <div className={`fixed bottom-0 left-0 w-96 h-96 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000 ${
                isDark ? 'bg-blue-500/20' : 'bg-blue-200/40'
            }`}></div>

            {/* Header Logos */}
            <div className="relative z-10 w-full flex justify-between items-center px-6 pt-8 max-w-7xl mx-auto">
                <div className="flex flex-col items-center">
                    <img src="/logo-new.png" alt="شعار الشركة" className="h-16 w-auto object-contain drop-shadow-lg animate-in fade-in zoom-in duration-700" />
                </div>
                <div className="flex flex-col items-center">
                    <img src="/icon-192.png" alt="شعار المديرية" className="h-16 w-16 object-contain drop-shadow-lg animate-in fade-in zoom-in duration-700 delay-100" />
                </div>
            </div>

            {/* Title Section */}
            <div className="relative z-10 flex flex-col items-center mt-8 mb-12 animate-in fade-in slide-in-from-top-8 duration-1000">
                <h1 className={`text-xl md:text-3xl font-extrabold text-center px-4 leading-relaxed max-w-3xl ${
                    isDark ? 'text-white' : 'text-slate-900'
                }`}>
                    اهلا بك في نظام الخدمات المتكاملة<br/>للشركة العامة للاتصالات والمعلوماتية
                </h1>
                <div className="h-1.5 w-24 bg-brand-green rounded-full mt-4 shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
                <h2 className={`mt-6 text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-brand-green to-emerald-400`}>
                    حدد محافظتك للمتابعة
                </h2>
            </div>

            {/* Governorate Grid */}
            <div className="relative z-10 w-full max-w-5xl mx-auto px-4 pb-20">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {governorates.map((gov, idx) => (
                        <button
                            key={gov.id}
                            onClick={() => handleSelect(gov)}
                            className={`group relative flex flex-col p-0 rounded-2xl border transition-all duration-300 overflow-hidden min-h-[120px] shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-4
                                ${gov.isActive 
                                    ? 'border-brand-green hover:ring-2 hover:ring-brand-green/30' 
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:scale-[1.02]'
                                }
                            `}
                            style={{ 
                                animationDelay: `${idx * 50}ms`,
                                backgroundColor: isDark ? '#1e293b' : '#ffffff'
                            }}
                        >
                            {/* Background Image - Using object-contain so no parts are cropped */}
                            <img 
                                src={`/govs/${gov.name}.jpeg`} 
                                alt={gov.name} 
                                onError={(e) => { 
                                    e.currentTarget.style.display = 'none'; 
                                }} 
                                className="absolute inset-0 w-full h-full object-contain z-0 transition-transform duration-700 group-hover:scale-105" 
                            />
                            
                            {/* Text Content - Aligned to bottom without background */}
                            <div className="absolute bottom-2 inset-x-0 z-20">
                                <span className="font-bold text-sm text-center block text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)]" style={{ textShadow: '0px 2px 8px rgba(0,0,0,0.9), 0px 0px 4px rgba(0,0,0,0.8)' }}>
                                    {gov.name}
                                </span>
                            </div>
                            
                            {gov.isActive && (
                                <div className="absolute top-0 right-0 bg-brand-green text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-20 shadow-md">
                                    متاح
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
