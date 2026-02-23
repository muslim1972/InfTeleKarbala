import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "../components/layout/Layout"; // Assuming we reuse Layout or build a custom one
import {
    Cpu,
    PlayCircle,
    Info,
    ChevronRight,
    BarChart3,
    ShieldCheck,
    Zap
} from "lucide-react";
import { cn } from "../lib/utils";
import { GlassCard } from "../components/ui/GlassCard";

// --- Tab System for Visitor ---
const VisitorTabs = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (t: string) => void }) => {
    const tabs = [
        { id: 'features', label: 'الميزات', icon: Cpu },
        { id: 'demo', label: 'جرب بنفسك', icon: PlayCircle },
        { id: 'about', label: 'عن النظام', icon: Info },
    ];

    return (
        <div className="relative flex gap-1 p-1 bg-muted/80 backdrop-blur-xl rounded-xl border border-white/10 dark:border-white/5 shadow-lg w-full ring-1 ring-black/5 dark:ring-white/5 mb-6">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "relative flex-1 flex items-center justify-center gap-2 py-3 px-3 text-sm font-bold rounded-lg transition-all duration-300 z-0 overflow-hidden",
                            isActive
                                ? "text-white shadow-md animate-in zoom-in-95 duration-200"
                                : "text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-white/5"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="activeVisitorTab"
                                className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] rounded-lg -z-10"
                                transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-50" />
                            </motion.div>
                        )}
                        <Icon className={cn("w-4 h-4 transition-transform", isActive && "scale-110")} />
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

// --- Onboarding Story Component ---
const OnboardingStory = ({ onComplete }: { onComplete: () => void }) => {
    const stories = [
        {
            id: 1,
            title: "نظام الإدارة الموحد",
            subtitle: "الإصدار الذكي",
            desc: "اكتشف كيف قمنا بتحويل البيروقراطية الإدارية إلى تجربة رقمية سلسة وتفاعلية.",
            icon: Zap,
            color: "from-blue-500 to-cyan-500"
        },
        {
            id: 2,
            title: "محرك مالي دقيق",
            subtitle: "حسابات فورية",
            desc: "تخيل نظاماً يحسب الرواتب، المخصصات، والضرائب تلقائياً بلمح البصر.",
            icon: BarChart3,
            color: "from-green-500 to-emerald-500"
        },
        {
            id: 3,
            title: "تجربة مستخدم فاخرة",
            subtitle: "تصميم مدروس",
            desc: "واجهات صممت لراحة العين، مع دعم كامل للوضع الليلي والهواتف الذكية.",
            icon: ShieldCheck, // Or Eye
            color: "from-purple-500 to-pink-500"
        }
    ];

    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < stories.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete(); // Finish
        }
    };

    const story = stories[currentStep];
    const Icon = story.icon;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
        >
            <GlassCard className="max-w-md w-full p-8 relative overflow-hidden border-white/20 shadow-2xl">
                {/* Progress Bar */}
                <div className="flex gap-2 mb-8 absolute top-0 left-0 right-0 p-4 z-20">
                    {stories.map((_, idx) => (
                        <div key={idx} className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: idx <= currentStep ? "100%" : "0%" }}
                                transition={{ duration: 0.5 }}
                                className={cn("h-full", idx <= currentStep ? "bg-white" : "bg-transparent")}
                            />
                        </div>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={story.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex flex-col items-center text-center space-y-6 pt-4"
                    >
                        <div className={cn(
                            "w-24 h-24 rounded-full flex items-center justify-center bg-gradient-to-br shadow-[0_0_30px_rgba(255,255,255,0.2)]",
                            story.color
                        )}>
                            <Icon className="w-10 h-10 text-white" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold text-white tracking-tight">{story.title}</h2>
                            <p className="text-blue-200 font-mono text-sm tracking-widest uppercase">{story.subtitle}</p>
                        </div>

                        <p className="text-white/80 leading-relaxed text-lg">
                            {story.desc}
                        </p>
                    </motion.div>
                </AnimatePresence>

                <div className="mt-10">
                    <button
                        onClick={handleNext}
                        className="w-full bg-white text-black hover:bg-white/90 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        <span>{currentStep === stories.length - 1 ? "ابدأ الجولة التقنية" : "التالي"}</span>
                        <ChevronRight className={cn("w-5 h-5", currentStep === stories.length - 1 ? "hidden" : "block")} />
                    </button>
                </div>
            </GlassCard>
        </motion.div>
    );
};

// --- Interactive Tooltip Tour ---
const VisitorTour = () => {
    const [step, setStep] = useState(1);

    if (step > 5) return null;

    const tourSteps = [
        {
            id: 1,
            title: "جرب بنفسك",
            text: "اضغط على صورتك الشخصية للدخول في تجربة المستخدم الحية (مؤقتة لهذه الجلسة).",
            position: "top-20 right-4",
            arrow: "absolute -top-2 right-6 w-4 h-4 bg-brand-green/90 rotate-45 border-l border-t border-white/20",
            delay: 1
        },
        {
            id: 2,
            title: "الوضع الليلي والنهاري",
            text: "تغيير سريع بين الوضع الفاتح والداكن لراحة عينيك.",
            position: "top-16 left-0 right-0 mx-auto w-max",
            arrow: "absolute -top-2 left-0 right-0 mx-auto w-4 h-4 bg-brand-green/90 rotate-45 border-l border-t border-white/20",
            delay: 0.2
        },
        {
            id: 3,
            title: "تسجيل الخروج",
            text: "للخروج الآمن من الجلسة وإنهاء التجربة بأي وقت.",
            position: "top-20 left-4",
            arrow: "absolute -top-2 left-6 w-4 h-4 bg-brand-green/90 rotate-45 border-l border-t border-white/20",
            delay: 0.2
        },
        {
            id: 4,
            title: "المحادثات",
            text: "تواصل واستفسر مباشرة عبر المساعد الذكي.",
            position: "bottom-24 left-24", // Adjusted to be next to the FAB
            arrow: "absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 bg-brand-green/90 rotate-45 border-l border-b border-white/20",
            delay: 0.2
        },
        {
            id: 5,
            title: "شريط الأخبار",
            text: "تابع أحدث الأخبار والتبليغات الهامة من خلال هذا الشريط المتحرك.",
            position: "bottom-32 left-0 right-0 mx-auto w-max", // Positioned above the AppFooter
            arrow: "absolute -bottom-2 left-0 right-0 mx-auto w-4 h-4 bg-brand-green/90 rotate-45 border-r border-b border-white/20",
            delay: 0.2
        }
    ];

    const currentTour = tourSteps.find(t => t.id === step);

    if (!currentTour) return null;

    return (
        <motion.div
            key={currentTour.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: currentTour.delay, duration: 0.5, type: "spring" }}
            className={`fixed z-[70] cursor-pointer hover:scale-105 transition-transform ${currentTour.position}`}
            onClick={() => setStep(prev => prev + 1)}
        >
            <div className="relative bg-brand-green/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-xl border border-white/20 max-w-[220px]">
                {/* Arrow */}
                <div className={currentTour.arrow} />

                <div className="flex gap-2 items-start relative z-10">
                    <div className="mt-1 min-w-[10px]">
                        <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                        </span>
                    </div>
                    <div>
                        <p className="font-bold text-sm mb-1 text-white">{currentTour.title}</p>
                        <p className="text-xs text-white/90 leading-relaxed">
                            {currentTour.text}
                        </p>
                        <p className="text-[10px] text-white/50 mt-2 text-left w-full">انقر للمتابعة</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export const VisitorDashboard = () => {
    const [activeTab, setActiveTab] = useState('features');
    const [showOnboarding, setShowOnboarding] = useState(true);

    return (
        <Layout headerTitle="معرض الإمكانيات" showUserName={true}>
            {/* Onboarding Overlay */}
            <AnimatePresence>
                {showOnboarding && (
                    <OnboardingStory onComplete={() => setShowOnboarding(false)} />
                )}
            </AnimatePresence>

            {/* Interactive Tour - Shown only after onboarding */}
            <AnimatePresence mode="wait">
                {!showOnboarding && <VisitorTour />}
            </AnimatePresence>

            <div className="max-w-4xl mx-auto px-4 py-6 relative min-h-[80vh]">

                {/* Intro Hero (visible after onboarding) */}
                {!showOnboarding && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-8 space-y-2"
                    >
                        <h1 className="text-2xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                            نظام الإدارة الموحد
                        </h1>
                        <p className="text-muted-foreground">استكشف مستقبل الإدارة الرقمية</p>
                    </motion.div>
                )}

                {/* Tabs */}
                <VisitorTabs activeTab={activeTab} onTabChange={setActiveTab} />

                {/* Content Area */}
                <div className="mt-8">
                    {activeTab === 'features' && (
                        <div className="grid md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Feature Cards Placeholder - Will be filled in Phase 2 */}
                            <GlassCard className="p-6 flex flex-col items-center text-center space-y-4 hover:border-blue-500/50 transition-colors group cursor-pointer border-dashed border-2 border-white/10 bg-transparent">
                                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <BarChart3 className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">المحرك المالي</h3>
                                <p className="text-muted-foreground text-sm">سيتم إضافة المحتوى في المرحلة 2...</p>
                            </GlassCard>

                            <GlassCard className="p-6 flex flex-col items-center text-center space-y-4 hover:border-purple-500/50 transition-colors group cursor-pointer border-dashed border-2 border-white/10 bg-transparent">
                                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <ShieldCheck className="w-8 h-8 text-purple-500" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">الأمان والصلاحيات</h3>
                                <p className="text-muted-foreground text-sm">سيتم إضافة المحتوى في المرحلة 2...</p>
                            </GlassCard>
                        </div>
                    )}

                    {activeTab === 'demo' && (
                        <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed border-border">
                            <PlayCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-xl font-bold text-foreground mb-2">منطقة التجربة الحية</h3>
                            <p className="text-muted-foreground">جاري بناء نموذج المحاكاة (Phase 3)...</p>
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed border-border">
                            <Info className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-xl font-bold text-foreground mb-2">عن النظام</h3>
                            <p className="text-muted-foreground">مواصفات وإحصائيات المشروع...</p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};
