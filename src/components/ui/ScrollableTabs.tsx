import { useRef, useState, useEffect } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "../../lib/utils";

interface Tab {
    id: string;
    label: string;
}

interface ScrollableTabsProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (id: string) => void;
    containerClassName?: string;
    tabClassName?: string;
    activeTabClassName?: string;
    inactiveTabClassName?: string;
}

export const ScrollableTabs = ({
    tabs,
    activeTab,
    onTabChange,
    containerClassName,
    tabClassName,
    activeTabClassName,
    inactiveTabClassName
}: ScrollableTabsProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            const scrollableWidth = scrollWidth - clientWidth;

            // Safety check: if no overflow, hide all
            if (scrollableWidth <= 0) {
                setShowLeftArrow(false);
                setShowRightArrow(false);
                return;
            }

            // Robust RTL detection: Check Computed Style
            const computedStyle = window.getComputedStyle(scrollContainerRef.current);
            const isRTL = computedStyle.direction === 'rtl';

            if (isRTL) {
                // In generic RTL (Start is Right):
                // We need to move Left (<) to see more content.
                // We need to move Right (>) to go back to start.

                // Detection of Coordinate System:
                // Type A (Positive): Start=Diff (Max), End=0. (Chrome sometimes) -> scrollLeft decreases as we go left.
                // Type B (Negative): Start=0, End=-Diff. (Standard) -> scrollLeft becomes negative (decreases) as we go left.
                // Type C (Positive Standard?): Start=0, End=Diff. (Some webviews) -> scrollLeft increases as we go left ?? (Rare for RTL)

                // Let's use a heuristic based on "Start" position.
                // At Initial Render, we are at "Start".
                // If scrollLeft is ~0, then Type B (or C).
                // If scrollLeft is large, then Type A.

                // But we can just check bounds relative to "Right" and "Left".
                // "Right Edge" (Start)
                // "Left Edge" (End)

                const current = scrollLeft;

                // Check if we are at Right Edge (Start)
                // Type A: current ~= scrollableWidth.
                // Type B: current ~= 0.

                // Check if we are at Left Edge (End)
                // Type A: current ~= 0.
                // Type B: current ~= -scrollableWidth.

                // Logic normalization:
                // Distance from Right Edge?

                if (current > 1) {
                    // Type A (Positive, Start=Max)
                    // At Right Edge, current = Max. DistFromRight = Max - current.
                    // At Left Edge, current = 0. DistFromRight = Max.
                    // Wait, usually Type A is: Start=Max, End=0.
                    // So DistFromRight = scrollableWidth - current.
                    // If current=Max (Start), Dist=0.

                    // BUT let's be simpler.
                    // Logic for Arrows in RTL:
                    // Left Arrow (<): Show if NOT at End (Leftmost).
                    // Right Arrow (>): Show if NOT at Start (Rightmost).

                    // If current > 1 (Type A):
                    // End is 0. So show Left Arrow if current > 1.
                    // Start is Max. So show Right Arrow if current < Max - 1.

                    setShowLeftArrow(current > 1);
                    setShowRightArrow(current < scrollableWidth - 1);

                } else {
                    // Type B (Negative/Zero, Start=0, End=-Max)
                    // Start is 0. End is -Max.
                    // Current is 0 or negative.

                    const absCurrent = Math.abs(current);

                    // Right Arrow (>): Go back to Start (0). Show if absCurrent > 1.
                    setShowRightArrow(absCurrent > 1);

                    // Left Arrow (<): Go to End (-Max). Show if absCurrent < Max - 1.
                    setShowLeftArrow(absCurrent < scrollableWidth - 1);
                }

            } else {
                // LTR Standard
                setShowLeftArrow(scrollLeft > 1);
                setShowRightArrow(scrollLeft < scrollableWidth - 1);
            }
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener("resize", checkScroll);
        return () => window.removeEventListener("resize", checkScroll);
    }, [tabs]);

    const scroll = (direction: "left" | "right") => {
        if (scrollContainerRef.current) {
            const scrollAmount = 150;
            const alignDirection = direction === "left" ? -scrollAmount : scrollAmount;

            scrollContainerRef.current.scrollBy({
                left: alignDirection,
                behavior: "smooth",
            });

            setTimeout(checkScroll, 300);
        }
    };

    return (
        <div className={cn("relative flex items-center group", containerClassName)}>
            {/* Scroll Right Button (Visually on the Right) */}
            {showRightArrow && (
                <button
                    onClick={(e) => { e.preventDefault(); scroll("right"); }}
                    className="absolute right-0 z-10 h-full px-1 bg-gradient-to-l from-black/20 to-transparent flex items-center justify-center text-white hover:bg-black/30 transition-colors rounded-r-lg"
                    style={{ backdropFilter: "blur(2px)" }}
                >
                    <ChevronRight className="w-5 h-5 drop-shadow-md" />
                </button>
            )}

            {/* Tabs Container */}
            <div
                ref={scrollContainerRef}
                className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-1 w-full"
                onScroll={checkScroll}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hide scrollbar
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "flex-none whitespace-nowrap px-4 py-2 rounded-lg transition-all font-bold text-xs",
                            activeTab === tab.id
                                ? activeTabClassName
                                : inactiveTabClassName,
                            tabClassName
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
                {/* Spacer to ensure last item isn't covered by arrow */}
                <div className="w-1 flex-none"></div>
            </div>

            {/* Scroll Left Button (Visually on the Left) */}
            {showLeftArrow && (
                <button
                    onClick={(e) => { e.preventDefault(); scroll("left"); }}
                    className="absolute left-0 z-10 h-full px-1 bg-gradient-to-r from-black/20 to-transparent flex items-center justify-center text-white hover:bg-black/30 transition-colors rounded-l-lg"
                    style={{ backdropFilter: "blur(2px)" }}
                >
                    <ChevronLeft className="w-5 h-5 drop-shadow-md" />
                </button>
            )}
        </div>
    );
};
