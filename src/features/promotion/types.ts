// ============================================
// أنواع TypeScript لميزة "دورات الترفيع"
// ============================================

/** نوع الدورة */
export type CourseType = 'technical' | 'administrative';

/** أسماء المواد */
export type SubjectKey = 'subject_1' | 'subject_2' | 'subject_3' | 'subject_4';

/** سؤال MCQ واحد */
export interface MCQQuestion {
    question: string;
    /** الخيارات الأربعة (مخلوطة الترتيب) */
    options: string[];
    /** فهرس الإجابة الصحيحة بعد الخلط */
    correctIndex: number;
}

/** نتيجة اختبار */
export interface PromotionResult {
    id: string;
    user_id: string;
    user_name: string;
    job_number: string | null;
    course_type: CourseType;
    subject_name: SubjectKey;
    score: number;
    total_questions: number;
    started_at: string;
    completed_at: string;
    duration_seconds: number | null;
    created_at: string;
}

/** إعدادات الاختبار */
export interface PromotionSettings {
    id: string;
    exam_active: boolean;
    exam_duration_minutes: number;
    updated_at: string;
    updated_by: string | null;
}

/** خريطة أسماء المواد للعرض */
export const SUBJECT_LABELS: Record<CourseType, Record<SubjectKey, string>> = {
    administrative: {
        subject_1: 'المادة الأولى',
        subject_2: 'المادة الثانية',
        subject_3: 'المادة الثالثة',
        subject_4: 'المادة الرابعة',
    },
    technical: {
        subject_1: 'المادة الأولى',
        subject_2: 'المادة الثانية',
        subject_3: 'المادة الثالثة',
        subject_4: 'المادة الرابعة',
    },
};

/** خريطة أنواع الدورات للعرض */
export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
    technical: 'دورة فنية',
    administrative: 'دورة إدارية',
};
