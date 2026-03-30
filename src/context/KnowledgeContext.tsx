import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { KnowledgeLevel, KnowledgeProgress } from "../types/knowledge";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

interface KnowledgeContextType {
    progress: KnowledgeProgress;
    loading: boolean;
    setPlacementResult: (level: KnowledgeLevel, score: number) => Promise<void>;
    markLessonCompleted: (lessonId: string) => Promise<void>;
    isLessonCompleted: (lessonId: string) => boolean;
    isLessonUnlocked: (lessonId: string, previousLessonId: string | null) => boolean;
    resetProgress: () => Promise<void>;
}

const DEFAULT_PROGRESS: KnowledgeProgress = {
    hasTakenPlacement: false,
    currentLevel: null,
    completedLessons: [],
    placementScore: 0,
    lastQuizIndex: 1
};

const KnowledgeContext = createContext<KnowledgeContextType | undefined>(undefined);

export const KnowledgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [progress, setProgress] = useState<KnowledgeProgress>(DEFAULT_PROGRESS);
    const [loading, setLoading] = useState(true);

    const fetchProgress = useCallback(async () => {
        if (!user || user.role === 'visitor') {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('knowledge_progress')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setProgress({
                    hasTakenPlacement: data.has_taken_placement,
                    currentLevel: data.current_level as KnowledgeLevel,
                    completedLessons: data.completed_lessons || [],
                    placementScore: data.placement_score || 0,
                    lastQuizIndex: data.last_quiz_index || 1
                });
            } else {
                setProgress(DEFAULT_PROGRESS);
            }
        } catch (err) {
            console.error("Failed to fetch knowledge progress:", err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    const setPlacementResult = async (level: KnowledgeLevel, score: number) => {
        if (!user || user.role === 'visitor') return;

        try {
            const updates = {
                user_id: user.id,
                has_taken_placement: true,
                current_level: level,
                placement_score: score,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('knowledge_progress')
                .upsert(updates, { onConflict: 'user_id' });

            if (error) throw error;

            setProgress(prev => ({ 
                ...prev, 
                hasTakenPlacement: true,
                currentLevel: level,
                completedLessons: [],
                placementScore: score
            }));
        } catch (err) {
            console.error("Failed to save placement result:", err);
            throw err;
        }
    };

    const markLessonCompleted = async (lessonId: string) => {
        if (!user || user.role === 'visitor') return;
        if (progress.completedLessons.includes(lessonId)) return;

        const newCompleted = [...progress.completedLessons, lessonId];

        try {
            const { error } = await supabase
                .from('knowledge_progress')
                .update({ completed_lessons: newCompleted })
                .eq('user_id', user.id);

            if (error) throw error;

            setProgress(prev => ({ ...prev, completedLessons: newCompleted }));
        } catch (err) {
            console.error("Failed to mark lesson completed:", err);
            throw err;
        }
    };

    const isLessonCompleted = (lessonId: string) => {
        return progress.completedLessons.includes(lessonId);
    };

    const isLessonUnlocked = (_lessonId: string, previousLessonId: string | null) => {
        if (!previousLessonId) return true;
        return isLessonCompleted(previousLessonId);
    };

    const resetProgress = async () => {
        if (!user || user.role === 'visitor') return;

        // Calculate next quiz index (1 -> 2 -> 3 -> 4 -> 1)
        const nextIndex = progress.lastQuizIndex >= 4 ? 1 : progress.lastQuizIndex + 1;

        try {
            const { error } = await supabase
                .from('knowledge_progress')
                .update({
                    has_taken_placement: false,
                    current_level: null,
                    completed_lessons: [],
                    placement_score: 0,
                    last_quiz_index: nextIndex
                })
                .eq('user_id', user.id);

            if (error) throw error;

            setProgress({
                ...DEFAULT_PROGRESS,
                lastQuizIndex: nextIndex
            });
        } catch (err) {
            console.error("Failed to reset progress:", err);
            throw err;
        }
    };

    return (
        <KnowledgeContext.Provider value={{ 
            progress, 
            loading, 
            setPlacementResult, 
            markLessonCompleted, 
            isLessonCompleted, 
            isLessonUnlocked, 
            resetProgress 
        }}>
            {children}
        </KnowledgeContext.Provider>
    );
};

export const useKnowledge = () => {
    const context = useContext(KnowledgeContext);
    if (context === undefined) {
        throw new Error("useKnowledge must be used within a KnowledgeProvider");
    }
    return context;
};
