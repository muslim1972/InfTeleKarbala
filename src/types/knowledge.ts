export type KnowledgeLevel = 'beginner' | 'intermediate' | 'advanced';

export interface QuizQuestion {
    id: string;
    text: string;
    options: {
        id: string;
        text: string;
        points: number; // 1 for correct basic, 2 for advanced correct, etc.
    }[];
}

export interface TelecomData {
    placementQuiz: QuizQuestion[];
    lessons: {
        beginner: LessonMeta[];
        intermediate: LessonMeta[];
        advanced: LessonMeta[];
    };
}

export interface LessonMeta {
    id: string;
    title: string;
    description: string;
    fileName: string; // The physical JSON file name to fetch e.g. "lesson_beg_01.json"
}

// These interfaces match the JSON structure inside lesson_beg_01.json
export type LessonSectionType = 'text' | 'image' | 'alert' | 'quote' | 'title' | 'math';

export interface LessonSection {
    id: string;
    type: LessonSectionType;
    content: string; // Text content, image URL, or alert body
    metadata?: {
        alertType?: 'info' | 'warning' | 'success'; 
        imageCaption?: string;
    };
}

export interface LessonContent {
    id: string;
    level: KnowledgeLevel;
    title: string;
    sections: LessonSection[];
}

export interface KnowledgeProgress {
    hasTakenPlacement: boolean;
    currentLevel: KnowledgeLevel | null;
    completedLessons: string[]; // Array of lesson IDs
    placementScore: number;
    lastQuizIndex: number; // 1, 2, or 3 for cyclic rotation
}
