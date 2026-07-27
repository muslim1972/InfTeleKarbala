/**
 * requestTypes.ts
 * Central registry for all request types available in the system.
 * Each entry maps to a component/form and provides metadata for the UI.
 */

import type { LeaveType } from './LeaveTypeSelector';

export interface RequestTypeOption {
  /** Unique ID - matches LeaveType for leave-based requests, or custom for others */
  id: string;
  /** Leave type used when submitting (null for non-leave requests) */
  leaveType?: LeaveType;
  /** Arabic display label */
  label: string;
  /** Emoji or icon string */
  emoji: string;
  /** Short description shown in dropdown */
  description: string;
  /** Tailwind color class for icon container */
  color: string;
  /** Tailwind background class for icon container */
  bgColor: string;
  /** Category grouping */
  category: 'leave' | 'administrative';
}

export const REQUEST_TYPE_OPTIONS: RequestTypeOption[] = [
  // ── Leave-based requests ────────────────────────────────────────────────────
  {
    id: 'time_off',
    leaveType: 'time_off',
    label: 'إجـازة زمنيـة',
    emoji: '⏱️',
    description: 'من 30 دقيقة حتى ساعتين',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    category: 'leave',
  },
  {
    id: 'duty',
    leaveType: 'duty',
    label: 'واجـب',
    emoji: '🛡️',
    description: 'مهمة رسمية ليوم واحد',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    category: 'leave',
  },
  {
    id: 'regular',
    leaveType: 'regular',
    label: 'إجازة اعتيادية (1–9) يوم',
    emoji: '📅',
    description: 'تُخصم من رصيدك تلقائياً',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    category: 'leave',
  },
  {
    id: 'long_regular',
    leaveType: 'long_regular',
    label: 'إجـازة اعتياديـة طويلـة',
    emoji: '🗓️',
    description: 'أكثر من 9 أيام • تحتاج براءة ذمة',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    category: 'leave',
  },
  {
    id: 'sick',
    leaveType: 'sick',
    label: 'فحـص طبـي / مرضيـة',
    emoji: '🩺',
    description: 'إجازة مرضية أو فحص طبي',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    category: 'leave',
  },
  {
    id: 'dispatch',
    leaveType: 'dispatch',
    label: 'إيـفـاد',
    emoji: '💼',
    description: 'مهمة عمل رسمية خارجية',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    category: 'leave',
  },
  // ── Administrative requests (future forms) ─────────────────────────────────
  {
    id: 'fuel',
    label: 'طلـب وقـود',
    emoji: '⛽',
    description: 'طلب تخصيص حصة وقود',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    category: 'administrative',
  },
  {
    id: 'service_extension',
    label: 'استمرار بالخدمـة',
    emoji: '📋',
    description: 'طلب تمديد الخدمة الوظيفية',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    category: 'administrative',
  },
  {
    id: 'transfer',
    label: 'نقـل خدمـات',
    emoji: '🔄',
    description: 'طلب نقل إلى دائرة أو قسم آخر',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-900/20',
    category: 'administrative',
  },
  {
    id: 'id_card',
    label: 'إصـدار هويـة',
    emoji: '🪪',
    description: 'طلب إصدار أو تجديد الهوية الوظيفية',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-900/20',
    category: 'administrative',
  },
];
