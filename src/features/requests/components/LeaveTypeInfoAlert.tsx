import { Info } from 'lucide-react';
import type { LeaveType } from './LeaveTypeSelector';

interface LeaveTypeInfoAlertProps {
  leaveType: LeaveType | 'long_regular' | 'long_sick'; // Ensure all requested types are covered
}

export function LeaveTypeInfoAlert({ leaveType }: LeaveTypeInfoAlertProps) {
  const getAlertConfig = (type: string) => {
    switch (type) {
      case 'regular':
        return {
          style: 'bg-blue-50/50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800/50',
          iconStyle: 'text-blue-500 dark:text-blue-400',
          text: 'الإجازة الاعتيادية: حتى 9 أيام. بعد موافقة المسؤول المباشر تصبح سارية المفعول وتُخصم من رصيدك.',
        };
      case 'long_regular':
        return {
          style: 'bg-purple-50/50 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-800/50',
          iconStyle: 'text-purple-500 dark:text-purple-400',
          text: '⚠️ الإجازة الاعتيادية الطويلة (أكثر من 9 أيام): بعد موافقة المسؤول المبدئية، يجب عليك الحضور لإكمال براءة الذمة والأمر الإداري قبل التمتع بالإجازة.',
        };
      case 'sick':
        return {
          style: 'bg-teal-50/50 text-teal-800 border-teal-200 dark:bg-teal-900/20 dark:text-teal-200 dark:border-teal-800/50',
          iconStyle: 'text-teal-500 dark:text-teal-400',
          text: 'الإجازة المرضية: حتى 21 يوم. بعد عودتك من المستشفى، سلّم كتاب المستشفى الموجه لمديريتنا إلى قسم الموارد البشرية لإكمال الإجراءات.',
        };
      case 'long_sick':
        return {
          style: 'bg-pink-50/50 text-pink-800 border-pink-200 dark:bg-pink-900/20 dark:text-pink-200 dark:border-pink-800/50',
          iconStyle: 'text-pink-500 dark:text-pink-400',
          text: '⚠️ الإجازة المرضية الطويلة (أكثر من 21 يوم): بعد الموافقة المبدئية من المسؤول، يرجى الحضور لإكمال إجراءات براءة الذمة والأمر الإداري. تحتاج تقرير طبي معتمد.',
        };
      case 'time_off':
        return {
          style: 'bg-cyan-50/50 text-cyan-800 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-200 dark:border-cyan-800/50',
          iconStyle: 'text-cyan-500 dark:text-cyan-400',
          text: 'الإجازة الزمنية: من 30 دقيقة إلى ساعتين. تحسب تراكمياً وكل 7 ساعات تعادل يوم إجازة يُخصم تلقائياً من رصيدك.',
        };
      case 'dispatch':
        return {
          style: 'bg-violet-50/50 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-200 dark:border-violet-800/50',
          iconStyle: 'text-violet-500 dark:text-violet-400',
          text: 'الإيفاد: لا تحتاج لتحديد عدد الأيام مسبقاً. بعد عودتك، سلّم كتاب إنهاء الإيفاد من الجهة الموفد إليها إلى قسم الموارد البشرية لتثبيت المدة.',
        };
      case 'duty':
        return {
          style: 'bg-amber-50/50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800/50',
          iconStyle: 'text-amber-500 dark:text-amber-400',
          text: 'الواجب الرسمي: ليوم واحد فقط (نفس يوم إصدار أمر الواجب). لا يُخصم من رصيد إجازاتك.',
        };
      default:
        return null;
    }
  };

  const config = getAlertConfig(leaveType);

  if (!config) return null;

  return (
    <div 
      className={`flex items-start gap-3 p-4 border rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300 ${config.style}`}
      dir="rtl"
    >
      <Info className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconStyle}`} />
      <p className="text-sm font-medium leading-relaxed">
        {config.text}
      </p>
    </div>
  );
}
