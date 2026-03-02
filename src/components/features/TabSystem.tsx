
import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { Wallet, FileText, PieChart, ChevronRight, ChevronLeft, ClipboardList, BookOpen } from "lucide-react";

interface TabSystemProps {
    activeTab: 'financial' | 'administrative' | 'polls' | 'requests' | 'training';
    onTabChange: (tab: 'financial' | 'administrative' | 'polls' | 'requests' | 'training') => void;
}

export const TabSystem = ({ activeTab, onTabChange }: TabSystemProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);
    const { user } = useAuth();

    const baseTabs = [
        { id: 'financial', label: 'المالية', icon: Wallet },
        { id: 'administrative', label: 'الذاتية', icon: FileText },
        { id: 'polls', label: 'الاعلام', icon: PieChart },
        { id: 'requests', label: 'الطلبات', icon: ClipboardList },
        { id: 'training', label: 'التدريب الصيفي', icon: BookOpen },
    ] as const;

    const tabs = baseTabs.filter(tab => {
        if (tab.id === 'requests') {
            return user?.role === 'admin' || user?.can_view_requests === true;
        }
        return true;
    });

    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            const scrollableWidth = scrollWidth - clientWidth;

            if (scrollableWidth <= 0) {
                setShowLeftArrow(false);
                setShowRightArrow(false);
                return;
            }

            // Simple LTR/RTL check locally or just robust checks
            // Assuming RTL behavior where scrollLeft can be negative or positive depending on browser implementation
            // But relying on simple bounds:
            // "Right" arrow (on UI right) scrolls "right" (which in RTL means towards start?)
            // Let's use the same logic as ScrollableTabs which seemed to work for the user
            const current = scrollLeft;
            const isRTL = window.getComputedStyle(scrollContainerRef.current).direction === 'rtl';

            if (isRTL) {
                // RTL Logic
                const absCurrent = Math.abs(current);
                // Right Arrow (Start direction)
                setShowRightArrow(absCurrent > 1);
                // Left Arrow (End direction)
                setShowLeftArrow(absCurrent < scrollableWidth - 1);
            } else {
                setShowLeftArrow(current > 1);
                setShowRightArrow(current < scrollableWidth - 1);
            }
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener("resize", checkScroll);
        return () => window.removeEventListener("resize", checkScroll);
    }, []);

    const scroll = (direction: "left" | "right") => {
        if (scrollContainerRef.current) {
            const scrollAmount = 150;
            // In RTL, "left" visually is negative x, "right" is positive x?
            // Actually, in standard scrolling:
            // RTL: "left" requires negative scrollBy? Or positive to go left?
            // Let's rely on standard: left moves scrollbar left, right moves it right.
            const alignDirection = direction === "left" ? -scrollAmount : scrollAmount;

            scrollContainerRef.current.scrollBy({
                left: alignDirection,
                behavior: "smooth",
            });

            setTimeout(checkScroll, 300);
        }
    };

    return (
        <div className="relative flex items-center group w-full">
            {/* Right Arrow (Visual Right) */}
            {showRightArrow && (
                <button
                    onClick={(e) => { e.preventDefault(); scroll("right"); }}
                    className="absolute right-0 z-20 h-full px-2 bg-gradient-to-l from-black/10 to-transparent flex items-center justify-center text-foreground hover:bg-black/20 transition-colors rounded-r-xl"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            )}

            <div
                ref={scrollContainerRef}
                className="relative flex gap-1 p-1 bg-muted/80 backdrop-blur-xl rounded-xl border border-white/10 dark:border-white/5 shadow-lg w-full ring-1 ring-black/5 dark:ring-white/5 overflow-x-auto scrollbar-hide"
                onScroll={checkScroll}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id as any)}
                            className={cn(
                                "relative flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-3 text-sm font-bold rounded-lg transition-all duration-300 z-0 overflow-hidden shrink-0",
                                isActive
                                    ? "text-white shadow-md animate-in zoom-in-95 duration-200"
                                    : "text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-white/5"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-gradient-to-r from-brand-green to-brand-green-dark shadow-[0_0_20px_rgba(34,197,94,0.4)] rounded-lg -z-10"
                                    transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}
                                >
                                    {/* Shiny Overlay Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-50" />
                                </motion.div>
                            )}
                            <Icon className={cn("w-4 h-4 transition-transform", isActive && "scale-110")} />
                            <span className="relative z-10">{tab.label}</span>
                        </button>
                    );
                })}
                {/* Spacer to allow scrolling to the very end if needed */}
                <div className="w-1 shrink-0" />
            </div>

            {/* Left Arrow (Visual Left) */}
            {showLeftArrow && (
                <button
                    onClick={(e) => { e.preventDefault(); scroll("left"); }}
                    className="absolute left-0 z-20 h-full px-2 bg-gradient-to-r from-black/10 to-transparent flex items-center justify-center text-foreground hover:bg-black/20 transition-colors rounded-l-xl"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
        </div>
    );
};
