// ============================================
// أنواع TypeScript لميزة "التدريب الصيفي"
// ============================================

/** نوع المؤسسة التعليمية */
export type InstitutionType = 'college' | 'school';

/** تسميات نوع المؤسسة */
export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
    college: 'كلية',
    school: 'إعدادية',
};

/** تقدير الطالب */
export type ExamGrade = 'excellent' | 'very_good' | 'good' | 'acceptable';

/** تسميات التقدير */
export const EXAM_GRADE_LABELS: Record<ExamGrade, string> = {
    excellent: 'امتياز',
    very_good: 'جيد جداً',
    good: 'جيد',
    acceptable: 'مقبول',
};

/** الحد الأقصى لمحاولات الاختبار */
export const MAX_EXAM_ATTEMPTS = 5;

/** حساب التقدير من النسبة المئوية */
export function calculateGrade(percentage: number): ExamGrade {
    if (percentage >= 90) return 'excellent';
    if (percentage >= 80) return 'very_good';
    if (percentage >= 70) return 'good';
    return 'acceptable';
}

/** سؤال MCQ واحد */
export interface MCQQuestion {
    question: string;
    /** الخيارات الأربعة (مخلوطة الترتيب) */
    options: string[];
    /** فهرس الإجابة الصحيحة بعد الخلط */
    correctIndex: number;
}

/** بيانات طالب متدرب */
export interface TrainingStudent {
    id: string;
    full_name: string;
    username: string;
    institution_type: InstitutionType;
    institution_name: string;
    department: string;
    start_date: string | null;
    end_date: string | null;
    exam_grade: ExamGrade | null;
    supervisor_id: string;
    created_at: string;
}

/** نتيجة اختبار تدريب صيفي */
export interface TrainingResult {
    id: string;
    student_id: string;
    score: number;
    total_questions: number;
    attempt_number: number;
    duration_seconds: number | null;
    exam_details?: {
        questions: MCQQuestion[];
        answers: (number | null)[];
    };
    started_at: string;
    completed_at: string;
    created_at: string;
}

/** إعدادات اختبار التدريب الصيفي */
export interface TrainingSettings {
    id: string;
    exam_active: boolean;
    exam_duration_minutes: number;
    updated_at: string;
    updated_by: string | null;
}
