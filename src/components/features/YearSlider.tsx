import { useRef } from "react";
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

    const scroll = (direction: 'left' | 'right') => {
        if (containerRef.current) {
            const scrollAmount = 200;
            // In RTL, typically scrolling "left" means decreasing scrollLeft (moving to visual left/end of list)
            // But browser behavior with RTL scroll can be tricky. 
            // Usually: 
            // Visual Right Button -> Scroll +ve (Right)
            // Visual Left Button -> Scroll -ve (Left)
            // Regardless of RTL, changing 'left' coordinate works physically.
            // If dir=rtl, scrollLeft starts at 0 (rightmost) and goes negative or positive depending on browser type. 
            // Chrome: 0 at right, negative to left. 
            // Let's rely on visual direction.
            if (direction === 'left') {
                containerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }
    };

    return (
        <div className="relative py-2 mb-2 group flex items-center gap-1">

            <button
                onClick={() => scroll('right')}
                className="p-1.5 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors z-10"
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
                                onClick={() => onYearChange(year)}
                                className={cn(
                                    "flex-shrink-0 relative px-3 py-1.5 rounded-xl transition-all duration-300 snap-center font-bold text-sm z-0",
                                    isSelected
                                        ? "text-white shadow-lg bg-brand-green ring-1 ring-brand-green/50"
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

            <button
                onClick={() => scroll('left')}
                className="p-1.5 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors z-10"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

        </div>
    );
};
