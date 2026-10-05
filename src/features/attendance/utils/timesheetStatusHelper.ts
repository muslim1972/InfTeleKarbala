import { parseISO, isValid, differenceInMinutes, format } from 'date-fns';

export interface DayStatusResult {
  text: string;
  badgeClass: string;
  style: string; // للتصدير إلى PDF
}

export interface SmartNoteItem {
  text: string;
  type: 'info' | 'warning' | 'danger' | 'success';
}

/**
 * تحديد الحالة الدقيقة لليوم في تقرير البصمة (Timesheets)
 * مع الحذف النهائي والتام لكلمة "حاضر" من القاموس
 */
export function getTimesheetDayStatus(params: {
  rec: any;
  dayType: string; // 'يوم عمل' | 'استراحة' | 'عطلة' | 'عطلة: ...'
  currentDateObj: Date;
  shiftInfo?: any;
  deficitMins: number;
  dayLeave?: any;
  timeLeaves?: any[];
}): DayStatusResult {
  const { rec, dayType, currentDateObj, shiftInfo, deficitMins, dayLeave } = params;

  // 1. جهاز غير معتمد
  if (rec.is_device_pending) {
    return {
      text: 'معلق (جهاز جديد)',
      badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300 font-bold',
      style: 'color: #b91c1c; font-weight: bold;'
    };
  }

  // 2. إجازة رسمية معتمدة (يوم كامل)
  if (dayLeave || rec.leaveLabel) {
    const label = rec.leaveLabel || (dayLeave?.leave_type === 'sick' ? 'مرضية' : 'اعتيادية');
    if (rec.check_in && !rec._isEmpty) {
      // إذا كان الموظف مناوباً ولديه أكثر من شفت، فالإجازة تسقط الشفت الأول والبصمة للشفت التالي وفق Flowchart 2
      if (shiftInfo?.isRoster && (shiftInfo.isEvening || shiftInfo.isNight)) {
        return {
          text: rec.check_out ? 'دوام مكتمل' : 'قيد الدوام',
          badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold',
          style: 'color: #047857; font-weight: bold;'
        };
      }
      return {
        text: 'دوام أثناء إجازة',
        badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-300 font-bold',
        style: 'color: #c2410c; font-weight: bold;'
      };
    }
    return {
      text: `مجاز (${label})`,
      badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold',
      style: 'color: #1d4ed8; font-weight: bold;'
    };
  }

  const isRestOrHoliday = dayType === 'استراحة' || dayType.startsWith('عطلة');

  // 3. يوم استراحة أو عطلة
  if (isRestOrHoliday) {
    if (rec.check_in && !rec._isEmpty) {
      const isRest = dayType === 'استراحة';
      return {
        text: isRest ? 'دوام في استراحة' : 'دوام في عطلة',
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 font-bold',
        style: 'color: #047857; font-weight: bold;'
      };
    }
    // لم يسجل بصمات في الاستراحة/العطلة
    return {
      text: dayType === 'استراحة' ? 'استراحة' : 'عطلة رسمية',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium',
      style: 'color: #64748b;'
    };
  }

  // 4. يوم عمل اعتيادي (Working Day)
  const isPastDay = currentDateObj.toDateString() !== new Date().toDateString() && currentDateObj < new Date();
  const isToday = currentDateObj.toDateString() === new Date().toDateString();

  // أ) لم يثبت أي بصمة إطلاقاً
  if (!rec.check_in || rec._isEmpty) {
    if (isPastDay) {
      return {
        text: 'غائب',
        badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 font-bold',
        style: 'color: #be123c; font-weight: bold;'
      };
    }
    if (isToday) {
      return {
        text: 'لم يحضر بعد',
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 font-medium',
        style: 'color: #b45309;'
      };
    }
    return {
      text: '--',
      badgeClass: 'text-slate-400',
      style: 'color: #94a3b8;'
    };
  }

  // ب) لديه بصمة دخول فقط بدون بصمة خروج
  if (rec.check_in && !rec.check_out) {
    if (isToday) {
      // اليوم جاري والموظف مسجل دخول وفي موقع عمله
      return {
        text: 'قيد الدوام',
        badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-300 font-bold',
        style: 'color: #0284c7; font-weight: bold;'
      };
    }
    // اليوم انتهى دون بصمة خروج
    return {
      text: 'بدون خروج',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 font-bold',
      style: 'color: #e11d48; font-weight: bold;'
    };
  }

  // ج) لديه دخول وخروج مكتملين
  if (rec.notes?.includes('خروج نهائي افتراضي')) {
    return {
      text: 'خروج افتراضي',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 font-bold',
      style: 'color: #d97706; font-weight: bold;'
    };
  }

  // فحص الخروج المبكر الصريح (خصوصاً في الخفر والمناوبات)
  if (rec.check_out && shiftInfo) {
    try {
      const outDate = parseISO(rec.check_out);
      if (isValid(outDate)) {
        if (shiftInfo.isRoster && shiftInfo.isNight) {
          const expectedOutDate = new Date(currentDateObj);
          expectedOutDate.setDate(expectedOutDate.getDate() + 1);
          expectedOutDate.setHours(8, 0, 0, 0);
          const earlyMins = differenceInMinutes(expectedOutDate, outDate);
          if (earlyMins > 120) {
            return {
              text: 'مغادرة الخفر مبكراً',
              badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 font-bold',
              style: 'color: #e11d48; font-weight: bold;'
            };
          }
        } else if (shiftInfo.expectedOut) {
          const expectedOutStr = `${format(outDate, 'yyyy-MM-dd')}T${shiftInfo.expectedOut}`;
          const expDate = parseISO(expectedOutStr);
          if (isValid(expDate)) {
            const earlyMins = differenceInMinutes(expDate, outDate);
            if (earlyMins > 60) {
              return {
                text: 'انصراف مبكر',
                badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 font-bold',
                style: 'color: #e11d48; font-weight: bold;'
              };
            }
          }
        }
      }
    } catch { }
  }

  if (rec.status === 'late') {
    return {
      text: 'متأخر',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 font-bold',
      style: 'color: #b45309; font-weight: bold;'
    };
  }

  if (deficitMins > 0) {
    return {
      text: 'نقص ساعات',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold',
      style: 'color: #b45309; font-weight: bold;'
    };
  }

  // دوام تام مكتمل أصولياً
  return {
    text: 'دوام مكتمل',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold',
    style: 'color: #047857; font-weight: bold;'
  };
}

/**
 * توليد الملاحظات الذكية والمتفاعلة تفصيلياً مع منطق التطبيق
 */
export function getTimesheetSmartNotes(params: {
  rec: any;
  dayType: string;
  currentDateObj: Date;
  shiftInfo: any;
  netMins: number;
  deficitMins: number;
  overtimeMins: number;
  dayLeave?: any;
  timeLeaves?: any[];
}): string {
  const { rec, dayType, currentDateObj, shiftInfo, dayLeave, timeLeaves = [] } = params;
  const notes: string[] = [];

  const isRestOrHoliday = dayType === 'استراحة' || dayType.startsWith('عطلة');
  const isPastDay = currentDateObj.toDateString() !== new Date().toDateString() && currentDateObj < new Date();
  const isToday = currentDateObj.toDateString() === new Date().toDateString();

  // 1. الدوام في يوم استراحة أو عطلة
  if (isRestOrHoliday && rec.check_in && !rec._isEmpty) {
    if (dayType === 'استراحة') {
      notes.push('دوام في يوم استراحة (يُحتسب كإضافي)');
    } else {
      notes.push(`دوام في عطلة (${dayType}) - يُحتسب كإضافي`);
    }
  }

  // 2. إجازة اليوم الكامل
  if (dayLeave || rec.leaveLabel) {
    const label = rec.leaveLabel || (dayLeave?.leave_type === 'sick' ? 'مرضية' : 'اعتيادية');
    if (rec.check_in && !rec._isEmpty) {
      if (shiftInfo?.isRoster && (shiftInfo.isEvening || shiftInfo.isNight)) {
        notes.push(`إجازة معتمدة (${label}) أسقطت الشفت الأول + حضور الشفت التالي`);
      } else {
        notes.push(`⚠️ دوام متعارض مع إجازة معتمدة (${label})`);
      }
    } else {
      notes.push(`متمتع بـ (${label}) معتمدة أصولياً`);
    }
  }

  // 3. الإجازات الزمنية المعتمدة
  if (timeLeaves.length > 0) {
    timeLeaves.forEach(tl => {
      const dur = tl.time_duration_minutes || 0;
      let timeRange = '';
      if (tl.leave_start_time && tl.leave_end_time) {
        timeRange = ` من ${tl.leave_start_time.substring(0, 5)} إلى ${tl.leave_end_time.substring(0, 5)}`;
      }
      notes.push(`إجازة زمنية معتمدة (${dur} دقيقة${timeRange})`);
    });
  }

  // 4. بصمات بطلب الموظف (حالات الطوارئ)
  if (rec.notes?.includes('تثبيت بطلب الموظف') || rec.notes?.includes('طلب الموظف')) {
    const match = rec.notes?.match(/تثبيت بطلب الموظف:\s*([^)]+)/);
    const reason = match ? match[1].trim() : 'وضع طارئ';
    notes.push(`⚠️ ثبتت بطلب الموظف: ${reason} (رُفعت للمسؤول)`);
  }

  // 5. جهاز غير معتمد
  if (rec.is_device_pending) {
    notes.push('⚠️ تسجيل من جهاز غير معتمد بانتظار الاعتماد');
  }

  // 6. بصمات افتراضية محقونة
  if (rec.notes?.includes('خروج نهائي افتراضي')) {
    notes.push('🚨 خروج نهائي افتراضي من النظام');
  }
  if (rec.notes?.includes('دخول اولي افتراضي')) {
    notes.push('🚨 دخول أولي افتراضي (خفر ممتد)');
  }

  // 7. غياب تام في يوم عمل
  if (!isRestOrHoliday && (!rec.check_in || rec._isEmpty)) {
    if (isPastDay && !dayLeave && !rec.leaveLabel) {
      notes.push('غياب عن الدوام بدون إجازة معتمدة');
    }
  }

  // 8. بصمة خروج ناقصة في يوم ماضٍ
  if (!isRestOrHoliday && rec.check_in && !rec.check_out && !rec._isEmpty) {
    if (isPastDay) {
      notes.push('⚠️ لم يتم تثبيت بصمة الخروج (نقص بصمة)');
    } else if (isToday) {
      notes.push('دوام مستمر (بانتظار بصمة الانصراف)');
    }
  }

  // 9. تفاصيل التأخير في الحضور
  const hasApprovedDayLeave = Boolean(dayLeave || rec.leaveLabel || rec.notes?.includes('إجازة'));
  if (rec.check_in && !rec._isEmpty && shiftInfo?.expectedIn && !isRestOrHoliday) {
    try {
      const inDate = parseISO(rec.check_in);
      if (isValid(inDate)) {
        let expectedTimeStr = shiftInfo.expectedIn;
        // إذا كان الموظف مناوباً ولديه إجازة معتمدة، تسقط النوبة الأولى ونقارن بوقت النوبة التالية
        if (hasApprovedDayLeave && shiftInfo.isRoster) {
          if (shiftInfo.isEvening && shiftInfo.isNight) {
            expectedTimeStr = '20:00';
          } else if (shiftInfo.isMorning && shiftInfo.isEvening) {
            expectedTimeStr = '14:30';
          }
        }

        // لا يُحسب تأخير إذا كان السجل غير موسوم بالتأخير في حال وجود إجازة معتمدة
        if (rec.status === 'late' || (!hasApprovedDayLeave && !shiftInfo.isRoster)) {
          const expectedInStr = `${format(inDate, 'yyyy-MM-dd')}T${expectedTimeStr}`;
          const expectedInDate = parseISO(expectedInStr);
          if (isValid(expectedInDate)) {
            const diff = differenceInMinutes(inDate, expectedInDate);
            const grace = expectedTimeStr === '08:00' ? 30 : 0;
            if (diff > grace) {
              notes.push(`تأخير في الحضور (${diff} دقيقة)`);
            }
          }
        }
      }
    } catch { }
  }

  // 10. تفاصيل الخروج المبكر
  if (rec.check_out && !rec._isEmpty && shiftInfo && !isRestOrHoliday) {
    try {
      const outDate = parseISO(rec.check_out);
      if (isValid(outDate)) {
        if (shiftInfo.isRoster && shiftInfo.isNight) {
          const expectedOutDate = new Date(currentDateObj);
          expectedOutDate.setDate(expectedOutDate.getDate() + 1);
          expectedOutDate.setHours(8, 0, 0, 0);
          const earlyMins = differenceInMinutes(expectedOutDate, outDate);
          if (earlyMins > 10) {
            const h = Math.floor(earlyMins / 60);
            const m = earlyMins % 60;
            notes.push(`🚨 خروج مبكر جداً من نوبة الخفر (${h}س و ${m}د - ترك موقع العمل)`);
          }
        } else if (shiftInfo.expectedOut) {
          const expectedOutStr = `${format(outDate, 'yyyy-MM-dd')}T${shiftInfo.expectedOut}`;
          const expDate = parseISO(expectedOutStr);
          if (isValid(expDate)) {
            const earlyMins = differenceInMinutes(expDate, outDate);
            if (earlyMins > 15) {
              notes.push(`⚠️ خروج مبكر (${earlyMins} دقيقة)`);
            }
          }
        }
      }
    } catch { }
  }

  // 11. مغادرة مؤقتة (فترات الراحة بين الدخول والخروج)
  if (rec.time_leave_out && rec.time_leave_return) {
    try {
      const outD = parseISO(rec.time_leave_out);
      const retD = parseISO(rec.time_leave_return);
      if (isValid(outD) && isValid(retD)) {
        const breakMins = differenceInMinutes(retD, outD);
        if (breakMins > 0) {
          notes.push(`مغادرة مؤقتة (${breakMins} دقيقة)`);
        }
      }
    } catch { }
  } else if (rec.time_leave_out && !rec.time_leave_return && !rec.check_out) {
    notes.push('⚠️ مغادرة مؤقتة (خروج دون تسجيل عودة)');
  }

  // 11. دمج أي ملاحظات يدوية إضافية كانت موجودة أصلاً ولم تكن جزءاً من النصوص التلقائية
  if (rec.notes) {
    const rawClean = rec.notes
      .replace(/\(?تثبيت بطلب الموظف:[^)]*\)?/g, '')
      .replace(/\(?تجاهل إجازة زمنية\)?/g, '')
      .replace(/🚨\s*خروج نهائي افتراضي/g, '')
      .replace(/🚨\s*دخول اولي افتراضي/g, '')
      .replace(/\(?خروج نهائي افتراضي\)?/g, '')
      .replace(/\(?دخول اولي افتراضي\)?/g, '')
      .replace(/⚠️\s*جهاز غير معتمد/g, '')
      .replace(/\(إجازة زمنية:[^)]*\)/g, '')
      .replace(/\|/g, '')
      .trim();

    if (rawClean && rawClean.length > 2 && !notes.some(n => n.includes(rawClean))) {
      notes.push(rawClean);
    }
  }

  if (notes.length === 0) {
    return '--';
  }

  return notes.join(' | ');
}
