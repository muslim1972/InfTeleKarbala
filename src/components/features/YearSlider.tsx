import { useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface YearSliderProps {
    startYear?: number;
    endYear?: number;
    selectedYear: number;
    onYearChange: (year: number) => void;
}

export const YearSlider = ({
    startYear = 2003,
    endYear = new Date().getFullYear(),
    selectedYear,
    onYearChange
}: YearSliderProps) => {
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i).reverse();
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

    // Auto-scroll to selected year when it changes
    useEffect(() => {
        const selectedBtn = itemRefs.current.get(selectedYear);
        if (selectedBtn && containerRef.current) {
            const container = containerRef.current;
            // Calculate center position
            // In RTL, scrollLeft works differently in some browsers, but scrollTo with 'left' usually targets physical pixels
            // Let's rely on standard calculation: center of container - center of item
            const scrollLeft = selectedBtn.offsetLeft - (container.clientWidth / 2) + (selectedBtn.clientWidth / 2);
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
    }, [selectedYear]);

    const handleYearStep = (direction: 'newer' | 'older') => {
        const currentIndex = years.indexOf(selectedYear);
        if (currentIndex === -1) return;

        // years are descending: [2024, 2023, 2022...]
        // newer = prev index (2024 is 0, 2023 is 1)
        // older = next index
        let newIndex = direction === 'newer' ? currentIndex - 1 : currentIndex + 1;

        // Clamp
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= years.length) newIndex = years.length - 1;

        if (newIndex !== currentIndex) {
            onYearChange(years[newIndex]);
        }
    };

    return (
        <div className="relative group flex items-center gap-1">

            {/* Right Arrow: Newer Years (Start of List) */}
            <button
                onClick={() => handleYearStep('newer')}
                disabled={selectedYear >= endYear}
                className="p-1.5 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors z-10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <ChevronRight className="w-4 h-4" />
            </button>

            <div className="relative flex-1 overflow-hidden">
                <div
                    ref={containerRef}
                    className="flex overflow-x-auto gap-2 py-2 px-1 no-scrollbar scroll-smooth snap-x"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {years.map((year) => {
                        const isSelected = selectedYear === year;
                        return (
                            <button
                                key={year}
                                ref={(el) => {
                                    if (el) itemRefs.current.set(year, el);
                                    else itemRefs.current.delete(year);
                                }}
                                onClick={() => onYearChange(year)}
                                className={cn(
                                    "flex-shrink-0 relative px-3 py-1.5 rounded-xl transition-all duration-300 snap-center font-bold text-sm z-0",
                                    isSelected
                                        ? "text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] bg-brand-green-DEFAULT ring-1 ring-white/50 scale-105 font-extrabold"
                                        : "text-white/40 hover:text-white/80 hover:bg-white/5"
                                )}
                            >
                                {year}
                            </button>
                        )
                    })}
                </div>
                {/* Fade Gradients */}
                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#0f172a]/90 to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#0f172a]/90 to-transparent pointer-events-none" />
            </div>

            {/* Left Arrow: Older Years (End of List) */}
            <button
                onClick={() => handleYearStep('older')}
                disabled={selectedYear <= startYear}
                className="p-1.5 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors z-10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

        </div >
    );
};
