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
    endYear = 2030,
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
            const invalidRTL = document.dir === 'rtl';
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
        <div className="relative py-4 mb-6 group flex items-center gap-2">

            <button
                onClick={() => scroll('right')}
                className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            >
                <ChevronRight className="w-5 h-5" />
            </button>

            <div className="relative flex-1 overflow-hidden">
                <div
                    ref={containerRef}
                    className="flex overflow-x-auto gap-3 py-4 px-2 no-scrollbar scroll-smooth snap-x"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {years.map((year) => {
                        const isSelected = selectedYear === year;
                        return (
                            <button
                                key={year}
                                onClick={() => onYearChange(year)}
                                className={cn(
                                    "flex-shrink-0 relative px-5 py-2 rounded-full transition-all duration-300 snap-center font-bold text-lg z-0",
                                    isSelected
                                        ? "text-white scale-110 shadow-[0_0_20px_rgba(34,197,94,0.4)] bg-brand-green"
                                        : "text-white/40 hover:text-white/80 hover:bg-white/5"
                                )}
                            >
                                {year}
                            </button>
                        )
                    })}
                </div>
                {/* Fade Gradients */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0f172a]/80 to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0f172a]/80 to-transparent pointer-events-none" />
            </div>

            <button
                onClick={() => scroll('left')}
                className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

        </div>
    );
};
