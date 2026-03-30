import { lazy, Suspense } from "react";
import { useKnowledgeProgress } from "../../../hooks/useKnowledgeProgress";
import { Loader2 } from "lucide-react";

// Lazy Load to keep the main bundle clean
const LevelPlacementQuiz = lazy(() => import("./LevelPlacementQuiz").then(m => ({ default: m.LevelPlacementQuiz })));
const LessonSeries = lazy(() => import("./LessonSeries").then(m => ({ default: m.LessonSeries })));

const LoadingScreen = () => (
    <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-white/60">جاري التحميل...</p>
    </div>
);

export const KnowledgeTabContent = () => {
    const { progress } = useKnowledgeProgress();

    return (
        <div className="w-full relative z-10 animate-fade-in-up">
            <Suspense fallback={<LoadingScreen />}>
                {!progress.hasTakenPlacement ? (
                    <LevelPlacementQuiz />
                ) : (
                    <LessonSeries />
                )}
            </Suspense>
        </div>
    );
};
