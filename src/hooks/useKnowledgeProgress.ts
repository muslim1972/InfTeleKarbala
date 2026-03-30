import { useKnowledge } from "../context/KnowledgeContext";

/**
 * Legacy hook wrapper that now uses KnowledgeContext
 * to provide global state synchronization.
 */
export const useKnowledgeProgress = () => {
    return useKnowledge();
};
