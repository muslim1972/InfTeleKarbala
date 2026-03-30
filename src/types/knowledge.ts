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
export type LessonBlockType = 'text' | 'image' | 'heading' | 'equation' | 'list' | 'note' | 'alert' | 'quote' | 'math';

export interface LessonBlock {
    id?: string;
    type: LessonBlockType;
    data: string | any; // For text, data is string. For list, data is array of strings.
    title?: string; // For list or note titles
    items?: string[]; // Specifically for list items
    image_url?: string; // For images
    caption?: string; // For image captions
}

export interface LessonContent {
    id: string; // lesson_id
    level: KnowledgeLevel;
    title: string;
    description: string;
    content_blocks: LessonBlock[];
    footer_summary?: string;
}

export interface KnowledgeProgress {
    hasTakenPlacement: boolean;
    currentLevel: KnowledgeLevel | null;
    completedLessons: string[]; // Array of lesson IDs
    placementScore: number;
    lastQuizIndex: number; // 1, 2, or 3 for cyclic rotation
}
