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
    // Theme handled via CSS variables now
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i).reverse();
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

    // Auto-scroll to selected year when it changes
    useEffect(() => {
        const selectedBtn = itemRefs.current.get(selectedYear);
        if (selectedBtn && containerRef.current) {
            const container = containerRef.current;
            // Calculate center position
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
                className={cn(
                    "p-1.5 rounded-full transition-colors z-10 disabled:opacity-30 disabled:cursor-not-allowed",
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
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
                                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                )}
                            >
                                {year}
                            </button>
                        )
                    })}
                </div>
                {/* Fade Gradients - Using semantic background color */}
                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
            </div>

            {/* Left Arrow: Older Years (End of List) */}
            <button
                onClick={() => handleYearStep('older')}
                disabled={selectedYear <= startYear}
                className={cn(
                    "p-1.5 rounded-full transition-colors z-10 disabled:opacity-30 disabled:cursor-not-allowed",
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

        </div >
    );
};
