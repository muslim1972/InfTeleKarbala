import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { timesheetService } from '../services/timesheetService';
import { supabase } from '../../../lib/supabase';
import { computeWorkedMinutes, formatDurationArabic, formatDurationDot, computeDeficitMinutes, computeOvertimeMinutes } from '../utils/attendanceCalc';
import { Calendar, ChevronDown, ChevronUp, FileSpreadsheet, X, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';

import { toast } from 'react-hot-toast';
import { EmployeeSearch } from '../../../components/shared/EmployeeSearch';
import { smoothScrollToId } from '../../../hooks/useSmoothScroll';
// ─── تكامل الإجازات (تقارير): عرض أيام الإجازات والدوام الإضافي فيها ───
import {
  getApprovedLeavesInRange,
  hasLeaveOvertimeNote,
  LEAVE_TYPE_LABELS,
  coversDate,
  DAY_LEAVE_TYPES,
  type LeaveRequestLite
} from '../services/leaveIntegrationService';


export default function Timesheets() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [departmentId, setDepartmentId] = useState('all');
  const [employeeId, setEmployeeId] = useState('all');
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  


  useEffect(() => {
    if (expandedEmp) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          smoothScrollToId(`timesheet-emp-${expandedEmp}`, 15);
        });
      });
    }
  }, [expandedEmp]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [workSchedules, setWorkSchedules] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [globalHolidays, setGlobalHolidays] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [monthLeaves, setMonthLeaves] = useState<LeaveRequestLite[]>([]);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    if (departmentId !== 'all') {
      setEmployeeId('all');
    }
  }, [departmentId]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('timesheets_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [year, month, departmentId, employeeId]);

  const loadFilters = async () => {
    try {
      const deps = await timesheetService.getDepartments();
      setDepartments(deps);
      
      const schedules = await timesheetService.getWorkSchedules();
      setWorkSchedules(schedules);

      const emps = await timesheetService.getEmployees();
      setAllEmployees(emps);

      const { data: settingsData } = await supabase.from('attendance_settings').select('*').eq('id', 1).single();
      if (settingsData) setGlobalSettings(settingsData);

      const { data: holidaysData } = await supabase.from('official_holidays').select('*');
      if (holidaysData) setGlobalHolidays(holidaysData);
    } catch (err) {
      console.error('Failed to load filters', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await timesheetService.getMonthlyTimesheets(year, month, departmentId, employeeId);
      setRecords(data);

      // ─── تكامل الإجازات (تقارير): جلب إجازات الشهر المعتمدة لتمييز أيام الإجازة عن الغياب ───
      const lastDay = new Date(year, month, 0).getDate();
      const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const endStr = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      const leaves = await getApprovedLeavesInRange(startStr, endStr);
      setMonthLeaves(leaves);
    } catch (err: any) {
      toast.error('فشل تحميل التقارير: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getShiftInfo = useCallback((empScheduleId: string | undefined, dateStr: string) => {
    const defaultSchedule = workSchedules.find(s => s.is_default) || workSchedules[0];
    const schedule = empScheduleId ? workSchedules.find(s => s.id === empScheduleId) : defaultSchedule;
    
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();
    const isRoster = schedule?.type === 'roster';
    const daySchedule = schedule?.days?.find((d: any) => d.day_of_week === dayOfWeek);

    const isMorning = daySchedule?.is_morning ?? (!daySchedule?.is_rest_day && daySchedule?.start_time?.startsWith('08'));
    const isEvening = daySchedule?.is_evening ?? (daySchedule?.start_time?.startsWith('14') || daySchedule?.end_time?.startsWith('20'));
    const isNight = daySchedule?.is_night ?? (daySchedule?.start_time?.startsWith('20') || daySchedule?.end_time?.startsWith('08'));

    const hasShifts = isMorning || isEvening || isNight;
    const isRest = isRoster ? !hasShifts : (daySchedule?.is_rest_day ?? false);

    // Label
    let label = 'صباحي';
    if (isRoster) {
      if (!hasShifts) label = 'تعويضية';
      else if (isEvening && isNight) label = 'مسائي + خفر';
      else if (isMorning && isEvening) label = 'صباحي + مسائي';
      else if (isMorning) label = 'صباحي';
      else if (isEvening) label = 'مسائي';
      else if (isNight) label = 'خفر';
    } else if (schedule?.name) {
      const raw = schedule.name;
      if (raw.includes('مسائي')) label = 'مسائي';
      else if (raw.includes('خفر')) label = 'خفر';
      else if (raw.includes('صباحي')) label = 'صباحي';
      else label = raw.replace(/الجدول|الافتراضي|\(|\)/g, '').trim() || 'صباحي';
    }

    // Expected check-in & check-out times
    let expectedIn = '08:00';
    let expectedOut = '15:00';

    if (isRoster) {
      if (isMorning) {
        expectedIn = '08:00';
        if (isNight) expectedOut = '08:00';
        else if (isEvening) expectedOut = '20:00';
        else expectedOut = '15:00';
      } else if (isEvening) {
        expectedIn = '14:30';
        if (isNight) expectedOut = '08:00';
        else expectedOut = '20:00';
      } else if (isNight) {
        expectedIn = '20:00';
        expectedOut = '08:00';
      } else {
        expectedIn = '08:00';
        expectedOut = '15:00';
      }
    } else {
      if (daySchedule && !daySchedule.is_rest_day) {
        expectedIn = daySchedule.start_time?.substring(0, 5) || '08:00';
        expectedOut = daySchedule.end_time?.substring(0, 5) || '15:00';
      }
    }

    return {
      schedule,
      isRoster,
      isRest,
      isMorning,
      isEvening,
      isNight,
      hasShifts,
      label,
      expectedIn,
      expectedOut
    };
  }, [workSchedules]);

  const getExpectedCheckoutTime = useCallback((empScheduleId: string | undefined, dateStr: string) => {
    return getShiftInfo(empScheduleId, dateStr).expectedOut;
  }, [getShiftInfo]);

  const getExpectedCheckinTime = useCallback((empScheduleId: string | undefined, dateStr: string) => {
    return getShiftInfo(empScheduleId, dateStr).expectedIn;
  }, [getShiftInfo]);

  const getDayTypeStr = useCallback((dateObj: Date, schedule: any) => {
    const isRoster = schedule?.type === 'roster';
    const dayOfWeek = dateObj.getDay();
    const daySchedule = schedule?.days?.find((d: any) => d.day_of_week === dayOfWeek);

    // If Roster schedule: holidays and weekends do NOT apply!
    if (isRoster) {
      const hasShifts = daySchedule?.is_morning || daySchedule?.is_evening || daySchedule?.is_night;
      if (hasShifts) return 'يوم عمل';
      return 'تعويضية';
    }

    // Standard Morning / Fixed schedule: governed by official holidays & weekends
    const dateOnly = format(dateObj, 'yyyy-MM-dd');
    const holiday = globalHolidays.find(h => dateOnly >= h.start_date && dateOnly <= h.end_date);
    if (holiday) return `عطلة: ${holiday.name}`;

    const dayNameEng = format(dateObj, 'EEEE');
    if (globalSettings?.weekend_days?.includes(dayNameEng)) {
       return 'عطلة';
    }

    if (daySchedule && daySchedule.is_rest_day) {
       return 'عطلة';
    }

    return 'يوم عمل';
  }, [globalHolidays, globalSettings]);

  const groupedData = useMemo(() => {
    const groups: Record<string, { employee: any, records: any[], totalWorkMins: number, totalDeficit: number, totalOvertime: number, lateCount: number, absenceCount: number, leaveCount: number }> = {};

    // ─── تكامل الإجازات (تقارير): خريطة إجازات اليوم الكامل المعتمدة لكل موظف ───
    const dayLeavesByEmp: Record<string, LeaveRequestLite[]> = {};
    monthLeaves.forEach(l => {
      if (!DAY_LEAVE_TYPES.includes(l.leave_type)) return;
      if (!dayLeavesByEmp[l.user_id]) dayLeavesByEmp[l.user_id] = [];
      dayLeavesByEmp[l.user_id].push(l);
    });

    const relevantEmployees = allEmployees.filter(emp => {
      if (departmentId !== 'all' && emp.department_id !== departmentId) return false;
      if (employeeId !== 'all' && emp.id !== employeeId) return false;
      return true;
    });

    relevantEmployees.forEach(emp => {
      groups[emp.id] = {
        employee: emp,
        records: [],
        totalWorkMins: 0,
        totalDeficit: 0,
        totalOvertime: 0,
        lateCount: 0,
        absenceCount: 0,
        leaveCount: 0
      };
    });

    records.forEach(rec => {
      const empId = rec.employee_id;
      if (!groups[empId]) {
        groups[empId] = {
          employee: rec.employee || { id: empId, full_name: 'موظف' },
          records: [],
          totalWorkMins: 0,
          totalDeficit: 0,
          totalOvertime: 0,
          lateCount: 0,
          absenceCount: 0,
          leaveCount: 0
        };
      }
      
      groups[empId].records.push(rec);
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const result = Object.values(groups).sort((a, b) => a.employee.full_name.localeCompare(b.employee.full_name));

    result.forEach(group => {
       const newRecords = [];
       const recordsByDay: Record<number, any[]> = {};
       group.records.forEach(r => {
           const dt = new Date(r.check_in || r.created_at);
           const day = dt.getDate();
           if (!recordsByDay[day]) recordsByDay[day] = [];
           recordsByDay[day].push(r);
       });

       const empScheduleId = group.employee?.work_schedule_id;
       
       for (let day = 1; day <= 31; day++) {
           if (day <= daysInMonth) {
               const currentDateObj = new Date(year, month - 1, day);
               const shiftInfo = getShiftInfo(empScheduleId, currentDateObj.toISOString());

               if (recordsByDay[day] && recordsByDay[day].length > 0) {
                   const rec = recordsByDay[day][0];
                   newRecords.push(rec);

                   const netMins = computeWorkedMinutes(rec, undefined, shiftInfo.expectedOut);
                   const defMins = computeDeficitMinutes(rec, shiftInfo.expectedIn, shiftInfo.expectedOut);
                   const ovtMins = computeOvertimeMinutes(rec, shiftInfo.expectedIn, shiftInfo.expectedOut);

                   group.totalWorkMins += netMins;
                   group.totalDeficit += defMins;
                   group.totalOvertime += ovtMins;
                   if (rec.status === 'late') group.lateCount++;
               } else {
                   const fakeDate = new Date(year, month - 1, day, 12, 0, 0).toISOString();
                   const dayType = getDayTypeStr(currentDateObj, shiftInfo.schedule);
                   const isWorkingDay = dayType === 'يوم عمل';

                   // ─── تكامل الإجازات: هل اليوم مغطى بإجازة معتمدة (يوم كامل)؟ ───
                   const dateStrKey = format(currentDateObj, 'yyyy-MM-dd');
                   const dayLeave = (dayLeavesByEmp[group.employee.id] || []).find(l => coversDate(l, dateStrKey));

                   if (dayLeave) {
                     group.leaveCount++;
                   } else if (isWorkingDay) {
                     group.absenceCount++;
                   }

                   newRecords.push({
                       _isEmpty: true,
                       check_in: fakeDate,
                       status: dayLeave ? 'leave' : (isWorkingDay ? 'absent' : (dayType === 'تعويضية' ? 'rest' : 'holiday')),
                       leaveLabel: dayLeave ? (LEAVE_TYPE_LABELS[dayLeave.leave_type] || 'إجازة') : undefined
                   });
               }
           } else {
               newRecords.push({
                   _isPadding: true
               });
           }
       }
       group.records = newRecords;
    });

    return result;
  }, [records, getShiftInfo, getDayTypeStr, year, month, monthLeaves]);

  const exportToPDF = async () => {
    if (groupedData.length === 0) return toast.error('لا يوجد بيانات للتصدير');
    
    const toastId = toast.loading('جاري تجهيز الملف وتصديره كـ PDF... يرجى الانتظار');
    try {

      const lastDay = new Date(year, month, 0).getDate();
      const printDate = new Date().toLocaleDateString('en-GB');

      // باني HTML لصفحة موظف واحد — يُستخدم في مسار الموظف الواحد (html2pdf)
      // ومسار الدفعة الكبيرة (jsPDF مباشرة) لضمان تطابق المخرجات 100%
      const buildEmployeeHtml = (group: any, i: number): string => {
        const pageBreakStyle = i > 0 ? 'page-break-before: always; padding-top: 10px;' : '';
        let html = '';

        html += `
          <div style="${pageBreakStyle}">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px;">
                <div style="text-align: right; flex: 1;">
                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 1px;">مديرية اتصالات ومعلوماتية</div>
                    <div style="font-size: 13px; font-weight: bold; margin-bottom: 1px;">كربلاء المقدسة</div>
                    <div style="font-size: 11px; font-weight: bold; color: #444;">تطبيق الادارة الموحد</div>
                </div>
                <div style="flex: 1; display: flex; justify-content: center; align-items: center;">
                    <img src="/icon-192.png" alt="شعار التطبيق" style="width: 50px; height: 50px; object-fit: contain;" crossorigin="anonymous" />
                </div>
                <div style="flex: 1; text-align: left;">
                    <div style="font-size: 9px; font-weight: bold; color: #555;">تاريخ الطباعة: ${printDate}</div>
                    <div style="font-size: 13px; font-weight: bold; margin-top: 2px; color: #0369a1;">تقرير البصمة لـ ${group.employee.full_name} لشهر ${format(new Date(year, month - 1, 1), 'MMMM', {locale: arSA})}</div>
                    <div style="font-size: 10px; color: #333; margin-top: 2px;">الفترة: 1-${month}-${year} إلى ${lastDay}-${month}-${year}</div>
                </div>
            </div>

            <table style="width: 100%; table-layout: fixed; border-collapse: collapse; text-align: center; margin-bottom: 3px;">
              <thead>
                <tr style="background-color: #f3f4f6; color: #111827;">
                  <th style="border: 1px solid #d1d5db; width: 72px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">التاريخ واليوم</span></th>
                  <th style="border: 1px solid #d1d5db; width: 48px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">نوع اليوم</span></th>
                  <th style="border: 1px solid #d1d5db; width: 38px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">التحقق</span></th>
                  <th style="border: 1px solid #d1d5db; width: 42px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">الدوام</span></th>

                  <th style="border: 1px solid #d1d5db; width: 38px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">دخول</span></th>
                  <th style="border: 1px solid #d1d5db; width: 40px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">ب. راحة 1</span></th>
                  <th style="border: 1px solid #d1d5db; width: 40px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">ع. راحة 1</span></th>
                  <th style="border: 1px solid #d1d5db; width: 40px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">ب. راحة 2</span></th>
                  <th style="border: 1px solid #d1d5db; width: 40px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">ع. راحة 2</span></th>
                  <th style="border: 1px solid #d1d5db; width: 38px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">خروج</span></th>
                  <th style="border: 1px solid #d1d5db; width: 38px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">الصافي</span></th>
                  <th style="border: 1px solid #d1d5db; width: 36px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">النقص</span></th>
                  <th style="border: 1px solid #d1d5db; width: 36px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">الإضافي</span></th>
                  <th style="border: 1px solid #d1d5db; width: 42px; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">الحالة</span></th>
                  <th style="border: 1px solid #d1d5db; height: 18px; line-height: 18px; font-size: 8px; font-weight: bold; padding: 0;"><span style="position: relative; top: -1px;">الملاحظات</span></th>
                </tr>
              </thead>
              <tbody>
        `;

        const ROW_H = '17px';
        // تحذير جوهري: في جداول CSS قيمة height للخلية حد أدنى فقط — أي line-height أكبر
        // من ارتفاع الصف (محاولة سابقة: 21px) يُنمّي كل صف فعلياً 17→21px فينزل يوم 30 و31
        // إلى صفحة ثانية، وoverflow:hidden لا يمنع هذا النمو.
        // الحل: line-height يبقى = ارتفاع الصف (17px) فيثبت الجدول بصفحة واحدة، ورفع النص
        // نحو المركز يتم بإزاحة relative على span شفاف يحيط بالنص وحده — html2canvas يرسم
        // النص من إحداثيات getClientRects الحقيقية فتُنقل الإزاحة النصَ 1:1 (كل 1px = 1px)
        // دون أي تأثير على ارتفاع الخلية. (الرفع المعتمد: 2px — يعادل تأثير lh=21px السابق).
        const TEXT_LIFT = '2px';
        const renderCell = (content: string, extraCss = '', isNumber = false) => {
          const fontCss = isNumber
            ? `font-family: 'Courier New', Courier, monospace; font-size: 8.5px; font-weight: bold; letter-spacing: 0.3px;`
            : `font-family: Arial, 'Segoe UI', Tahoma, sans-serif; font-size: 8.5px; font-weight: bold;`;
          return `<td style="border: 1px solid #d1d5db; height: ${ROW_H}; line-height: ${ROW_H}; padding: 0; text-align: center; vertical-align: middle; white-space: nowrap; overflow: hidden; ${fontCss} ${extraCss}"><span style="position: relative; top: -${TEXT_LIFT};">${content}</span></td>`;
        };

        for (const rec of group.records) {
          if (rec._isPadding) {
             html += `<tr style="height: ${ROW_H};">`;
             for(let c=0; c<15; c++) {
                 html += renderCell('&nbsp;');
             }
             html += `</tr>`;
             continue;
          }
          const dateStrRaw = rec.check_in ? rec.check_in : new Date(year, month - 1, 1).toISOString();
          const dateObj = parseISO(dateStrRaw);
          const dateStr = format(dateObj, 'EEEE d / M / yyyy', { locale: arSA });
          const scheduleId = rec.work_schedule_id || group.employee?.work_schedule_id;
          const shiftInfo = getShiftInfo(scheduleId, dateStrRaw);
          const dayType = getDayTypeStr(dateObj, shiftInfo.schedule);
          
          if (rec._isEmpty) {
             const isLeaveDay = rec.status === 'leave';
             const leaveLabel = rec.leaveLabel || 'إجازة';
             html += `<tr style="height: ${ROW_H};">`;
             html += renderCell(dateStr);
             html += renderCell(dayType);
             html += renderCell('--');
             html += renderCell(shiftInfo.label);
             html += renderCell('--:--', isLeaveDay ? 'color: #ea580c; font-weight: bold;' : '', true);
             html += renderCell('--:--', '', true);
             html += renderCell('--:--', '', true);
             html += renderCell('--:--', '', true);
             html += renderCell('--:--', '', true);
             html += renderCell('--:--', isLeaveDay ? 'color: #ea580c; font-weight: bold;' : '', true);
             html += renderCell('--', '', true);
             html += renderCell('--', '', true);
             html += renderCell('--', '', true);
             html += renderCell(
               isLeaveDay ? leaveLabel : dayType === 'تعويضية' ? 'راحة' : dayType.startsWith('عطلة') ? 'عطلة' : 'غائب',
               isLeaveDay ? 'color: #ea580c; font-weight: bold;' : ''
             );
             html += renderCell(
               isLeaveDay ? leaveLabel : dayType === 'تعويضية' ? 'تعويضية' : 'لا توجد بصمات',
               isLeaveDay ? 'color: #ea580c; font-weight: bold;' : 'color: #999;'
             );
             html += `</tr>`;
             continue;
          }
          const inTime = rec.check_in ? format(parseISO(rec.check_in), 'HH:mm') : '--:--';
          const isPastDay = dateObj.toDateString() !== new Date().toDateString();
          const isForgotCheckout = !rec.check_out && isPastDay && rec.check_in;
          
          const expectedCheckout = shiftInfo.expectedOut;
          const expectedCheckin = shiftInfo.expectedIn;
          
          const outTime = rec.check_out 
            ? format(parseISO(rec.check_out), 'HH:mm') 
            : (isForgotCheckout ? expectedCheckout : '--:--');

          const scheduleName = shiftInfo.label;

          const leaveOutStr = rec.time_leave_out ? format(parseISO(rec.time_leave_out), 'HH:mm') : '--:--';
          const leaveReturnStr = rec.time_leave_return ? format(parseISO(rec.time_leave_return), 'HH:mm') : '--:--';
          const leaveOut2Str = rec.time_leave_out_2 ? format(parseISO(rec.time_leave_out_2), 'HH:mm') : '--:--';
          const leaveReturn2Str = rec.time_leave_return_2 ? format(parseISO(rec.time_leave_return_2), 'HH:mm') : '--:--';
          
          const netMins = computeWorkedMinutes(rec, undefined, expectedCheckout);
          const deficitMins = computeDeficitMinutes(rec, expectedCheckin, expectedCheckout);
          const overtimeMins = computeOvertimeMinutes(rec, expectedCheckin, expectedCheckout);
          
          // Verification logic
          let verifyMethod = 'يدوي';
          if (rec.check_in_snapshot_url) verifyMethod = 'وجه';
          else if (rec.check_in_location) verifyMethod = 'موقع';
          else if (rec.is_auto_check_out) verifyMethod = 'تلقائي';
          

          // ─── تكامل الإجازات: يوم إجازة أدى فيه الموظف دواماً → عرض الأوقات بالبرتقالي ───
          const isLeaveOvertimeDay = hasLeaveOvertimeNote(rec.notes);
          const leaveOvertimeColor = 'color: #ea580c; font-weight: bold;';

          const outTimeColor = (isForgotCheckout || rec.is_auto_check_out) ? 'color: #e11d48;' : '';
          const inTimeColor = rec.status === 'late' ? 'color: #e11d48;' : '';
          const deficitColor = deficitMins > 0 ? 'color: #e11d48; font-weight: bold;' : '';
          const overtimeColor = overtimeMins > 0 ? 'color: #059669; font-weight: bold;' : '';
          
          const cleanNotesText = rec.is_device_pending
            ? (rec.notes || '')
            : (rec.notes || '')
                .replace(/\(?دخول:\s*جهاز غير معتمد\)?/gi, '')
                .replace(/\(?خروج:\s*جهاز غير معتمد\)?/gi, '')
                .replace(/\(?تم التسجيل من جهاز غير معتمد\)?/gi, '')
                .replace(/\s*-\s*/g, ' ')
                .trim();

          html += `
            <tr style="height: ${ROW_H};">
              ${renderCell(dateStr)}
              ${renderCell(dayType)}
              ${renderCell(verifyMethod)}
              ${renderCell(scheduleName)}

              ${renderCell(inTime, isLeaveOvertimeDay ? leaveOvertimeColor : inTimeColor, true)}
              ${renderCell(leaveOutStr, '', true)}
              ${renderCell(leaveReturnStr, '', true)}
              ${renderCell(leaveOut2Str, '', true)}
              ${renderCell(leaveReturn2Str, '', true)}
              ${renderCell(outTime, isLeaveOvertimeDay ? leaveOvertimeColor : outTimeColor, true)}
              ${renderCell(formatDurationDot(netMins), isLeaveOvertimeDay ? leaveOvertimeColor : '', true)}
              ${renderCell(deficitMins > 0 ? formatDurationDot(deficitMins) : '--', deficitColor, true)}
              ${renderCell(overtimeMins > 0 ? formatDurationDot(overtimeMins) : '--', isLeaveOvertimeDay ? leaveOvertimeColor : overtimeColor, true)}
              ${renderCell(rec.status === 'present' ? 'حاضر' : rec.status === 'late' ? 'متأخر' : rec.status === 'absent' ? 'غائب' : rec.status)}
              ${renderCell(cleanNotesText || '', 'font-size: 7.5px;')}
            </tr>
          `;
        }

        html += `
                <tr style="background-color: #f8fafc; font-weight: bold;">
                  <td colspan="15" style="padding: 4px; border: 1px solid #d1d5db; text-align: left; color: #334155;">
                    إجمالي الصافي: ${formatDurationDot(group.totalWorkMins)} | 
                    إجمالي النقص: ${formatDurationDot(group.totalDeficit)} | 
                    إجمالي الإضافي: ${formatDurationDot(group.totalOvertime)} | 
                    تأخير: ${group.lateCount} | غياب: ${group.absenceCount} | إجازات: ${group.leaveCount}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
        return html;
      };

      // ===== مسار الدفعة الكبيرة (أكثر من موظف واحد) =====
      // السبب الجذري للصفحات البيضاء سابقاً: html2pdf يرسم المستند كله في كانفس واحد ضخم،
      // والكانفس في المتصفح له حدود قصوى (نحو 268 مليون بكسل مساحةً وطول <= 32767px).
      // 355 موظفاً = كانفس بنحو 983 مليون بكسل → فشل تخصيص صامت → كانفس فارغ → صفحات بيضاء.
      // الحل: html2canvas لكل موظف على حدة (كانفس ~3 ملايين بكسل فقط) + بناء PDF مباشرة بـ jsPDF.
      if (groupedData.length > 1) {
        const [{ jsPDF: JsPDF }, html2canvasMod] = await Promise.all([
          import('jspdf'),
          import('html2canvas'),
        ]);
        const html2canvas: (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement> =
          (html2canvasMod as any).default ?? html2canvasMod;

        const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 5;
        const contentW = pageW - margin * 2;
        const contentH = pageH - margin * 2;

        // حاوية مخفية خارج الشاشة بنفس عرض windowWidth المعتمد سابقاً (1050px)
        const holder = document.createElement('div');
        holder.setAttribute('dir', 'rtl');
        holder.style.cssText = 'position: absolute; top: 0; left: -11000px; width: 1050px; background: #ffffff; margin: 0;';
        document.body.appendChild(holder);

        // ─── إصلاح التباطؤ التصاعدي (كان 5 ثوانٍ للموظف الأول → 3 دقائق عند الموظف 250) ───
        // السبب الجذري 1 (الأهم — تسرب ذاكرة): كل موظف يخصص كانفس بظهر ~12MB، والمتصفح
        //   يؤجل تحرير الظهور حتى GC، فتتراكم غيغابايتات عند مئات الموظفين → اختناق GC
        //   وتباطؤ تصاعدي وتجمد شبه كامل. العلاج: تصفير width/height بعد كل استخدام =
        //   تحرير فوري وحتمي لظهر الكانفس (لا ننتظر GC إطلاقاً).
        // السبب 2 (كلفة ثابتة عالية): html2canvas يستنسخ كامل مستند الصفحة (واجهة التطبيق
        //   بجداولها الضخمة) في كل استدعاء. العلاج: ignoreElements لاستنساخ holder وسلسلة
        //   أسلافه فقط → زمن ثابت ومنخفض لكل موظف.
        // السبب 3 (كلفة مخفية في jsPDF): addImage بلا alias يجعل jsPDF يحسب hash حرفاً
        //   بحرف على نص base64 كامل (~1MB) لكل صورة. العلاج: alias فريد قصير لكل صفحة.
        const keepForClone = new Set<Element>([
          document.documentElement, document.head, document.body, holder,
        ]);
        const ignoreExceptHolder = (el: Element) =>
          !(keepForClone.has(el) || holder.contains(el));

        // ─── إعدادات ضغط مخرجات الدفعة الكبيرة ───
        // المشكلة: 355 صفحة × 718KB (scale 2 + جودة 0.98) = 255MB.
        // الحل المعتمد: scale 1.6 (≈149DPI بدل 186) + جودة JPEG 0.85 → متوقع ~50MB (خفض ~80%)
        // مع بقاء النص حاداً: يُرسم vector عند 1.6×، و0.85 لا تُحدث تشوهات على النصوص.
        // (خفض الجودة وحدها إلى 0.80 مع scale 2 يُشوّه حروف 8.5px — مجرّب ومرفوض).
        // لتعديل الحساسية مستقبلاً: غيّر هذين الرقمين فقط (أعلى = أجود وأكبر حجماً).
        const EXPORT_SCALE = 1.6;
        const EXPORT_JPEG_QUALITY = 0.85;

        const total = groupedData.length;
        const t0 = performance.now();

        try {
          for (let i = 0; i < total; i++) {
            const recStart = performance.now();
            const group = groupedData[i];
            toast.loading(
              `جاري التصدير: الموظف ${i + 1} من ${total} — ${group.employee.full_name}`,
              { id: toastId }
            );

            // 0 = بلا فاصل صفحات (كل موظف يُرسم وحده ويبدأ صفحة PDF جديدة أدناه)
            // ملاحظة: لا يوجد أي استعلام قاعدة بيانات داخل الحلقة — كل البيانات مقروءة
            // مسبقاً في groupedData (جلب واحد قبل التصدير، وSupabase بلا اتصالات دائمة)
            holder.innerHTML = buildEmployeeHtml(group, 0);

            // انتظار إطارين لضمان اكتمال التخطيط قبل الالتقاط
            await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));

            const canvas = await html2canvas(holder, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              windowWidth: 1050,
              // استنساخ holder فقط دون واجهة التطبيق → ثبات زمن كل موظف
              ignoreElements: ignoreExceptHolder,
            });

            // إضافة الكانفس للـPDF مع تقطيعه إن تجاوز صفحة (نادر — التصميم يتسع بصفحة واحدة)
            const pxPerMm = canvas.width / contentW;
            const sliceHpx = Math.floor(contentH * pxPerMm);
            let y = 0;
            let sliceIdx = 0;
            while (y < canvas.height) {
              const h = Math.min(sliceHpx, canvas.height - y);
              let pageCanvas: HTMLCanvasElement = canvas;
              let isTempSlice = false;
              if (h < canvas.height) {
                pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = h;
                pageCanvas.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
                isTempSlice = true;
              }
              if (!(y === 0 && i === 0)) pdf.addPage('a4', 'landscape');
              pdf.addImage(
                pageCanvas.toDataURL('image/jpeg', EXPORT_JPEG_QUALITY),
                'JPEG',
                margin,
                margin,
                contentW,
                h / pxPerMm,
                `emp${i}_p${sliceIdx}`,
                'FAST'
              );
              // تحرير فوري لأي شريحة مؤقتة
              if (isTempSlice) { pageCanvas.width = 0; pageCanvas.height = 0; }
              y += h;
              sliceIdx++;
            }

            // تحرير فوري وحتمي لظهر الكانفس الرئيسي (~12MB) — جوهر إصلاح التسرب
            canvas.width = 0;
            canvas.height = 0;
            holder.innerHTML = '';

            // إتاحة حلقة الأحداث بين الموظفين: واجهة سلسة + فرصة GC
            await new Promise((r) => setTimeout(r, 0));

            // قياس زمن كل سجل (Console) للتحقق من ثبات الأداء عبر كامل العملية
            const perRec = ((performance.now() - recStart) / 1000).toFixed(1);
            const elapsedMin = ((performance.now() - t0) / 60000).toFixed(1);
            console.info(`[تصدير PDF] موظف ${i + 1}/${total}: ${perRec} ث | إجمالي منذ البداية: ${elapsedMin} د`);
          }
        } finally {
          document.body.removeChild(holder);
        }

        // ترقيم الصفحات بنفس أسلوب المسار الآخر
        const totalPages = pdf.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
          pdf.setPage(p);
          pdf.setFontSize(10);
          pdf.setTextColor(100);
          pdf.text(`${p} / ${totalPages}`, pageW / 2, pageH - 5, { align: 'center' });
        }

        await pdf.save(`جدول_الحضور_والانصراف_${month}_${year}.pdf`);
        toast.success('تم تصدير الملف بنجاح', { id: toastId });
        return;
      }

      // ===== مسار الموظف الواحد: html2pdf كما هو — مثبت ويعمل 100% =====
      let html = `
        <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: black; background: white; width: 1030px; margin: 0 auto; padding: 0 10px; box-sizing: border-box;">
      `;

      for (let i = 0; i < groupedData.length; i++) {
        html += buildEmployeeHtml(groupedData[i], i);
      }

      html += `</div>`;

      const opt = {
          margin: [5, 5, 5, 5], // mm (top, left, bottom, right)
          filename: `جدول_الحضور_والانصراف_${month}_${year}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
              scale: 2, 
              useCORS: true,
              logging: false,
              windowWidth: 1050
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
          enableLinks: true,
          pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' }
      };

      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set(opt)
        .from(html)
        .toPdf()
        .get('pdf')
        .then((pdf: any) => {
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(10);
            pdf.setTextColor(100);
            pdf.text(
              `${i} / ${totalPages}`, 
              pdf.internal.pageSize.getWidth() / 2, 
              pdf.internal.pageSize.getHeight() - 5, 
              { align: 'center' }
            );
          }
        })
        .save();

      toast.success('تم تصدير الملف بنجاح', { id: toastId });
    } catch (err: any) {
      console.error('Export Error:', err);
      toast.error('فشل تصدير الملف: ' + err.message, { id: toastId });
    }
  };

  const exportSingleEmployeeWithImages = async (e: React.MouseEvent, targetGroup: any) => {
    e.stopPropagation();
    const toastId = toast.loading('جاري تجهيز التقرير مع الصور كـ PDF... يرجى الانتظار');
    
    try {
      const urlToBase64Png = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = url;
        });
      };

      const printDate = new Date().toLocaleDateString('en-GB');

      let html = `
        <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: black; background: white; width: 1030px; margin: 0 auto; padding: 0 10px; box-sizing: border-box;">
      `;

      const group = targetGroup;
      html += `
        <div style="page-break-inside: avoid; margin-bottom: 20px;">
          <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #1e293b; padding-bottom: 10px;">
            <h2 style="margin: 0; font-size: 20px; color: #0f172a;">تقرير البصمة لـ ${group.employee.full_name} لشهر ${month} / ${year}</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">تاريخ الطباعة: ${printDate}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: center;">
            <thead style="background-color: #f1f5f9; font-weight: bold; color: #334155;">
              <tr>
                <th style="padding: 2px; border: 1px solid #d1d5db;">التاريخ</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">نوع اليوم</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">التحقق</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">الدوام</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">ص. دخول</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">ص. خروج</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">دخول</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">ب. راحة 1</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">ع. راحة 1</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">ب. راحة 2</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">ع. راحة 2</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">خروج</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">الصافي</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">النقص</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">الإضافي</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">الحالة</th>
                <th style="padding: 2px; border: 1px solid #d1d5db;">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
      `;

      const numStyle = `font-family: 'Courier New', Courier, monospace; font-size: 8.5px; font-weight: bold; letter-spacing: 0.3px;`;
      const textStyle = `font-family: Arial, 'Segoe UI', Tahoma, sans-serif; font-size: 8.5px; font-weight: bold;`;

      for (let j = 0; j < group.records.length; j++) {
        const rec = group.records[j];
        if (rec._isPadding) continue;

        const tdStyle = `padding: 1px 2px; border: 1px solid #d1d5db; height: 16px; vertical-align: middle; ${textStyle}`;
        const tdNumStyle = `padding: 1px 2px; border: 1px solid #d1d5db; height: 16px; vertical-align: middle; ${numStyle}`;
        
        const dateStrRaw = rec.check_in ? rec.check_in : new Date(year, month - 1, j + 1).toISOString();
        const dateObj = parseISO(dateStrRaw);
        const dateStr = format(dateObj, 'EEEE d / M / yyyy', { locale: arSA });
        const scheduleId = rec.work_schedule_id || group.employee?.work_schedule_id;
        const shiftInfo = getShiftInfo(scheduleId, dateStrRaw);
        const dayType = getDayTypeStr(dateObj, shiftInfo.schedule);

        if (rec._isEmpty) {
            const isRest = dayType === 'تعويضية';
            const isHoliday = dayType.startsWith('عطلة');
            const isWorking = dayType === 'يوم عمل';
            const isLeaveDay = rec.status === 'leave';
            const leaveLabel = rec.leaveLabel || 'إجازة';

            html += `<tr style="border-bottom: 1px solid #e5e7eb; background-color: ${isWorking && !isLeaveDay ? '#fef2f2' : '#f8fafc'};">`;
            html += `<td style="${tdStyle} white-space: nowrap;">${dateStr}</td>`;
            html += `<td style="${tdStyle}">${dayType}</td>`;
            html += `<td style="${tdStyle}">--</td>`;
            html += `<td style="${tdStyle}">${shiftInfo.label}</td>`;
            html += `<td style="${tdStyle}">--</td>`;
            html += `<td style="${tdStyle}">--</td>`;
            html += `<td style="${tdNumStyle} ${isWorking && !isLeaveDay ? 'color: #e11d48;' : isLeaveDay ? 'color: #ea580c; font-weight: bold;' : ''}">--:--</td>`;
            html += `<td style="${tdNumStyle}">--:--</td>`;
            html += `<td style="${tdNumStyle}">--:--</td>`;
            html += `<td style="${tdNumStyle}">--:--</td>`;
            html += `<td style="${tdNumStyle}">--:--</td>`;
            html += `<td style="${tdNumStyle} ${isWorking && !isLeaveDay ? 'color: #e11d48;' : isLeaveDay ? 'color: #ea580c; font-weight: bold;' : ''}">--:--</td>`;
            html += `<td style="${tdNumStyle}">--</td>`;
            html += `<td style="${tdNumStyle}">--</td>`;
            html += `<td style="${tdNumStyle}">--</td>`;
            html += `<td style="${tdStyle} ${isLeaveDay ? 'color: #ea580c; font-weight: bold;' : ''}">${isLeaveDay ? leaveLabel : isRest ? 'راحة' : isHoliday ? 'عطلة' : 'غائب'}</td>`;
            html += `<td style="${tdStyle} font-size: 8px; ${isLeaveDay ? 'color: #ea580c; font-weight: bold;' : ''}">${isLeaveDay ? leaveLabel : isRest ? 'تعويضية' : 'لا توجد بصمات'}</td>`;
            html += `</tr>`;
            continue;
        }
        
        const inTime = rec.check_in ? format(parseISO(rec.check_in), 'HH:mm') : '--:--';
        const isPastDay = dateObj.toDateString() !== new Date().toDateString();
        const isForgotCheckout = !rec.check_out && isPastDay && rec.check_in;
        
        const expectedCheckout = shiftInfo.expectedOut;
        const expectedCheckin = shiftInfo.expectedIn;
        
        const outTime = rec.check_out 
          ? format(parseISO(rec.check_out), 'HH:mm') 
          : (isForgotCheckout ? expectedCheckout : '--:--');

        const scheduleName = shiftInfo.label;

        const leaveOutStr = rec.time_leave_out ? format(parseISO(rec.time_leave_out), 'HH:mm') : '--:--';
        const leaveReturnStr = rec.time_leave_return ? format(parseISO(rec.time_leave_return), 'HH:mm') : '--:--';
        const leaveOut2Str = rec.time_leave_out_2 ? format(parseISO(rec.time_leave_out_2), 'HH:mm') : '--:--';
        const leaveReturn2Str = rec.time_leave_return_2 ? format(parseISO(rec.time_leave_return_2), 'HH:mm') : '--:--';
        
        const netMins = computeWorkedMinutes(rec, undefined, expectedCheckout);
        const deficitMins = computeDeficitMinutes(rec, expectedCheckin, expectedCheckout);
        const overtimeMins = computeOvertimeMinutes(rec, expectedCheckin, expectedCheckout);
        
        let verifyMethod = 'يدوي';
        if (rec.check_in_snapshot_url) verifyMethod = 'وجه';
        else if (rec.check_in_location) verifyMethod = 'موقع';
        else if (rec.is_auto_check_out) verifyMethod = 'تلقائي';

        let checkInImgHtml = '-';
        if (rec.check_in_snapshot_url) {
          try {
             const b64 = await urlToBase64Png(rec.check_in_snapshot_url);
             checkInImgHtml = `<img src="${b64}" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover; border: 1px solid #ccc; vertical-align: middle;" />`;
          } catch (e) {
             checkInImgHtml = `(صورة)`;
          }
        }

        let checkOutImgHtml = '-';
        if (rec.check_out_snapshot_url) {
           try {
             const b64 = await urlToBase64Png(rec.check_out_snapshot_url);
             checkOutImgHtml = `<img src="${b64}" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover; border: 1px solid #ccc; vertical-align: middle;" />`;
          } catch (e) {
             checkOutImgHtml = `(صورة)`;
          }
        }

        const outTimeColor = (isForgotCheckout || rec.is_auto_check_out) ? 'color: #e11d48; font-weight: bold;' : '';
        const inTimeColor = rec.status === 'late' ? 'color: #e11d48;' : '';
        const deficitColor = deficitMins > 0 ? 'color: #e11d48; font-weight: bold;' : '';
        const overtimeColor = overtimeMins > 0 ? 'color: #059669; font-weight: bold;' : '';
        
        html += `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="${tdStyle} white-space: nowrap;">${dateStr}</td>
            <td style="${tdStyle}">${dayType}</td>
            <td style="${tdStyle}">${verifyMethod}</td>
            <td style="${tdStyle}">${scheduleName}</td>
            <td style="${tdStyle}">${checkInImgHtml}</td>
            <td style="${tdStyle}">${checkOutImgHtml}</td>
            <td style="${tdNumStyle} ${inTimeColor}">${inTime}</td>
            <td style="${tdNumStyle}">${leaveOutStr}</td>
            <td style="${tdNumStyle}">${leaveReturnStr}</td>
            <td style="${tdNumStyle}">${leaveOut2Str}</td>
            <td style="${tdNumStyle}">${leaveReturn2Str}</td>
            <td style="${tdNumStyle} ${outTimeColor}">${outTime}</td>
            <td style="${tdNumStyle}">${formatDurationDot(netMins)}</td>
            <td style="${tdNumStyle} ${deficitColor}">${deficitMins > 0 ? formatDurationDot(deficitMins) : '--'}</td>
            <td style="${tdNumStyle} ${overtimeColor}">${overtimeMins > 0 ? formatDurationDot(overtimeMins) : '--'}</td>
            <td style="${tdStyle}">${rec.status === 'present' ? 'حاضر' : rec.status === 'late' ? 'متأخر' : rec.status === 'absent' ? 'غائب' : rec.status}</td>
            <td style="${tdStyle} font-size: 8px;">${rec.notes || ''}</td>
          </tr>
        `;
      }

      html += `
              <tr style="background-color: #f8fafc; font-weight: bold;">
                <td colspan="17" style="padding: 4px; border: 1px solid #d1d5db; text-align: left; color: #334155;">
                  إجمالي الصافي: ${formatDurationDot(group.totalWorkMins)} | 
                  إجمالي النقص: ${formatDurationDot(group.totalDeficit)} | 
                  إجمالي الإضافي: ${formatDurationDot(group.totalOvertime)} | 
                  تأخير: ${group.lateCount} | غياب: ${group.absenceCount} | إجازات: ${group.leaveCount}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      html += `</div>`;

      const opt = {
          margin: [5, 5, 5, 5],
          filename: `جدول_حضور_${group.employee.full_name}_${month}_${year}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
              scale: 2, 
              useCORS: true,
              logging: false,
              windowWidth: 1050
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
          pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' }
      };

      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set(opt)
        .from(html)
        .toPdf()
        .get('pdf')
        .then((pdf: any) => {
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(10);
            pdf.setTextColor(100);
            pdf.text(
              `${i} / ${totalPages}`, 
              pdf.internal.pageSize.getWidth() / 2, 
              pdf.internal.pageSize.getHeight() - 5, 
              { align: 'center' }
            );
          }
        })
        .save();

      toast.success('تم تصدير الملف بنجاح', { id: toastId });
    } catch (err: any) {
      console.error('Export Error:', err);
      toast.error('فشل تصدير الملف: ' + err.message, { id: toastId });
    }
  };



  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">السنة</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none dark:text-white">
              {[0, 1, 2, 3].map(offset => (
                <option key={offset} value={new Date().getFullYear() - offset}>{new Date().getFullYear() - offset}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">الشهر</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none dark:text-white">
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i+1} value={i+1}>{format(new Date(2000, i, 1), 'MMMM', { locale: arSA })}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">القسم</label>
            <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none w-48 dark:text-white">
              <option value="all">كل الأقسام</option>
              {departments.map(dep => (
                <option key={dep.id} value={dep.id}>{dep.name}</option>
              ))}
            </select>
          </div>
          <div className="w-56">
            <label className="block text-xs font-medium text-slate-500 mb-1">الموظف</label>
            <EmployeeSearch 
              value={employeeSearchQuery}
              onChange={(val: string) => {
                setEmployeeSearchQuery(val);
                if (!val) setEmployeeId('all');
              }}
              onSelect={(emp: any) => {
                setEmployeeId(emp.id);
                setEmployeeSearchQuery(emp.full_name);
              }}
              placeholder="كل الموظفين..."
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={loadData}
            disabled={loading}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap text-sm font-medium disabled:opacity-50"
            title="إعادة تحميل البيانات وتحديث التقرير"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث التقرير
          </button>
          <div>
            <button 
              onClick={() => exportToPDF()} 
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap text-sm font-medium"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تصدير PDF
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : groupedData.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">لا توجد سجلات</h3>
          <p className="text-slate-500 mt-2">لا توجد سجلات حضور للمحددات المختارة في هذا الشهر.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedData.map(group => (
            <div id={`timesheet-emp-${group.employee.id}`} key={group.employee.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm transition-all">
              {/* Summary Row */}
              <div 
                onClick={() => setExpandedEmp(expandedEmp === group.employee.id ? null : group.employee.id)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold">
                    {group.employee.full_name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white">{group.employee.full_name}</h4>
                    <p className="text-xs text-slate-500">{group.employee.job_number}</p>
                  </div>
                </div>
                
                <div className="hidden md:flex gap-6 text-center items-center">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">الصافي</div>
                    <div className="font-bold text-blue-600">{formatDurationDot(group.totalWorkMins)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">النقص</div>
                    <div className="font-bold text-rose-600">{formatDurationDot(group.totalDeficit)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">الإضافي</div>
                    <div className="font-bold text-emerald-600">{formatDurationDot(group.totalOvertime)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">متأخر/غياب</div>
                    <div className="font-bold text-slate-600 dark:text-slate-400">{group.lateCount} / {group.absenceCount}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedEmp === group.employee.id && (
                       <button
                         onClick={(e) => exportSingleEmployeeWithImages(e, group)}
                         className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                       >
                         <FileSpreadsheet className="w-3 h-3" />
                         تصدير مع الصور
                       </button>
                    )}
                    <div className="text-slate-400">
                      {expandedEmp === group.employee.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Records (Expanded) */}
              {expandedEmp === group.employee.id && (
                <div className="bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <tr>
                          <th className="px-3 py-3 rounded-r-lg">التاريخ</th>
                          <th className="px-3 py-3">نوع اليوم</th>
                          <th className="px-3 py-3">التحقق</th>
                          <th className="px-3 py-3">الدوام</th>
                          <th className="px-2 py-2 text-center">الصور</th>
                          <th className="px-3 py-3">دخول</th>
                          <th className="px-3 py-3">ب. راحة 1</th>
                          <th className="px-3 py-3">ع. راحة 1</th>
                          <th className="px-3 py-3">ب. راحة 2</th>
                          <th className="px-3 py-3">ع. راحة 2</th>
                          <th className="px-3 py-3">خروج</th>
                          <th className="px-3 py-3">الصافي</th>
                          <th className="px-3 py-3">النقص</th>
                          <th className="px-3 py-3">الإضافي</th>
                          <th className="px-3 py-3">الحالة</th>
                          <th className="px-3 py-3 rounded-l-lg">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.records.map((rec, i) => {
                          if (rec._isPadding) {
                              return (
                                  <tr key={`padding-${i}`} className="border-b border-slate-100 dark:border-slate-800">
                                      <td colSpan={16} className="px-3 py-3 text-sm text-center">&nbsp;</td>
                                  </tr>
                              );
                          }
                          const dateStrRaw = rec.check_in ? rec.check_in : new Date(year, month - 1, 1).toISOString();
                          const dateObj = parseISO(dateStrRaw);
                          const dateStr = format(dateObj, 'EEEE d / M / yyyy', { locale: arSA });
                          const scheduleId = rec.work_schedule_id || group.employee?.work_schedule_id;
                          const shiftInfo = getShiftInfo(scheduleId, dateStrRaw);
                          const dayType = getDayTypeStr(dateObj, shiftInfo.schedule);
                          
                          if (rec._isEmpty) {
                              const isLeaveDay = rec.status === 'leave';
                              const leaveLabel = rec.leaveLabel || 'إجازة';
                              return (
                                  <tr key={`empty-${i}`} className="border-b border-slate-100 dark:border-slate-800">
                                      <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-300">{dateStr}</td>
                                      <td className="px-3 py-3 text-sm">
                                        <span className={dayType === 'تعويضية' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold text-xs' : dayType.startsWith('عطلة') ? 'text-amber-600 font-bold text-xs' : 'text-slate-500'}>
                                          {dayType}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-sm text-slate-400">--</td>
                                      <td className="px-3 py-3 text-sm">
                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-xs">{shiftInfo.label}</span>
                                      </td>
                                      <td colSpan={12} className={`px-3 py-3 text-sm text-center ${isLeaveDay ? 'text-orange-600 font-bold' : 'text-slate-400'}`}>
                                        {isLeaveDay ? `${leaveLabel} (يوم إجازة معتمدة)` : dayType === 'تعويضية' ? 'يوم استراحة تعويضية' : 'لا توجد بصمات'}
                                      </td>
                                  </tr>
                              );
                          }
                          const inTime = rec.check_in ? format(parseISO(rec.check_in), 'HH:mm') : '--:--';
                          const isPastDay = dateObj.toDateString() !== new Date().toDateString();
                          const isForgotCheckout = !rec.check_out && isPastDay && rec.check_in;
                          const expectedCheckout = shiftInfo.expectedOut;
                          const expectedCheckin = shiftInfo.expectedIn;
                          
                          const outTime = rec.check_out 
                            ? format(parseISO(rec.check_out), 'HH:mm') 
                            : (isForgotCheckout ? expectedCheckout : '--:--');
                          
                          const scheduleName = shiftInfo.label;

                          const leaveOutStr = rec.time_leave_out ? format(parseISO(rec.time_leave_out), 'HH:mm') : '--:--';
                          const leaveReturnStr = rec.time_leave_return ? format(parseISO(rec.time_leave_return), 'HH:mm') : '--:--';
                          const leaveOut2Str = rec.time_leave_out_2 ? format(parseISO(rec.time_leave_out_2), 'HH:mm') : '--:--';
                          const leaveReturn2Str = rec.time_leave_return_2 ? format(parseISO(rec.time_leave_return_2), 'HH:mm') : '--:--';
                          
                          const netMins = computeWorkedMinutes(rec, undefined, expectedCheckout);
                          const deficitMins = computeDeficitMinutes(rec, expectedCheckin, expectedCheckout);
                          const overtimeMins = computeOvertimeMinutes(rec, expectedCheckin, expectedCheckout);
                          
                          let verifyMethod = 'يدوي';
                          if (rec.check_in_snapshot_url) verifyMethod = 'وجه';
                          else if (rec.check_in_location) verifyMethod = 'موقع';
                          else if (rec.is_auto_check_out) verifyMethod = 'تلقائي';

                          const unverified = rec.notes && (
                            rec.notes.includes('الكاميرا') ||
                            rec.notes.includes('وجه') ||
                            rec.notes.includes('خلل') ||
                            rec.notes.includes('فشل') ||
                            rec.notes.includes('بدون')
                          );

                          // ─── تكامل الإجازات: يوم إجازة أدى فيه الموظف دواماً → عرض الأوقات بالبرتقالي ───
                          const isLeaveOvertimeDay = hasLeaveOvertimeNote(rec.notes);

                          return (
                            <tr key={rec.id || i} className={rec.is_device_pending ? "bg-red-50/70 dark:bg-red-950/20 hover:bg-red-100/70 dark:hover:bg-red-950/30" : "border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-white dark:hover:bg-slate-800 transition-colors"}>
                              <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-300">{dateStr}</td>
                              <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                                <span className={dayType === 'عطلة' ? 'text-amber-600 font-bold' : ''}>{dayType}</span>
                              </td>
                              <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">{verifyMethod}</td>
                              <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-xs">{scheduleName}</span>
                              </td>
                              <td className="px-2 py-2 min-w-[100px]">
                                <div className="flex items-center justify-center gap-1">
                                  {rec.check_in_snapshot_url ? (
                                    <div role="button" tabIndex={0} onClick={() => setSelectedImage(rec.check_in_snapshot_url!)} className="relative group overflow-hidden rounded-md border-2 border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all w-10 h-10 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-sm cursor-pointer block" title="تكبير صورة الدخول">
                                      <img src={rec.check_in_snapshot_url} alt="دخول" className="w-full h-full object-cover md:group-hover:scale-110 transition-transform duration-300 pointer-events-none block" loading="lazy" />
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 shrink-0 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700" />
                                  )}
                                  
                                  {rec.check_out_snapshot_url ? (
                                    <div role="button" tabIndex={0} onClick={() => setSelectedImage(rec.check_out_snapshot_url!)} className="relative group overflow-hidden rounded-md border-2 border-teal-100 dark:border-teal-900/30 hover:border-teal-500 dark:hover:border-teal-500 transition-all w-10 h-10 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-sm cursor-pointer block" title="تكبير صورة الخروج">
                                      <img src={rec.check_out_snapshot_url} alt="خروج" className="w-full h-full object-cover md:group-hover:scale-110 transition-transform duration-300 pointer-events-none block" loading="lazy" />
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 shrink-0 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700" />
                                  )}
                                </div>
                              </td>
                              <td className={`px-3 py-3 font-mono ${isLeaveOvertimeDay ? 'text-orange-600 font-bold' : unverified ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>{inTime}</td>
                              <td className="px-3 py-3 text-amber-600 font-mono">{leaveOutStr}</td>
                              <td className="px-3 py-3 text-amber-600 font-mono">{leaveReturnStr}</td>
                              <td className="px-3 py-3 text-amber-600 font-mono">{leaveOut2Str}</td>
                              <td className="px-3 py-3 text-amber-600 font-mono">{leaveReturn2Str}</td>
                              <td className={`px-3 py-3 font-mono ${isLeaveOvertimeDay ? 'text-orange-600 font-bold' : isForgotCheckout || unverified ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>{outTime}</td>
                              <td className={`px-3 py-3 font-bold ${isLeaveOvertimeDay ? 'text-orange-600' : 'text-blue-600'}`}>{formatDurationDot(netMins)}</td>
                              <td className="px-3 py-3 font-bold text-rose-600">{deficitMins > 0 ? formatDurationDot(deficitMins) : '--'}</td>
                              <td className={`px-3 py-3 font-bold ${isLeaveOvertimeDay ? 'text-orange-600' : 'text-emerald-600'}`}>{overtimeMins > 0 ? formatDurationDot(overtimeMins) : '--'}</td>
                              <td className="px-3 py-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  rec.is_device_pending ? 'bg-red-100 text-red-800 border border-red-200' :
                                  rec.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                                  rec.status === 'late' ? 'bg-rose-100 text-rose-800' :
                                  'bg-slate-100 text-slate-800'
                                }`}>
                                  {rec.is_device_pending ? 'معلق (جهاز جديد)' : rec.status === 'present' ? 'حاضر' : rec.status === 'late' ? 'متأخر' : rec.status}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-500">
                                {rec.is_device_pending ? <span className="text-red-600 dark:text-red-400 font-bold block mb-1">⚠️ جهاز غير معتمد</span> : null}
                                {(() => {
                                  const clean = rec.is_device_pending
                                    ? (rec.notes || '')
                                    : (rec.notes || '')
                                        .replace(/\(?دخول:\s*جهاز غير معتمد\)?/gi, '')
                                        .replace(/\(?خروج:\s*جهاز غير معتمد\)?/gi, '')
                                        .replace(/\(?تم التسجيل من جهاز غير معتمد\)?/gi, '')
                                        .replace(/\s*-\s*/g, ' ')
                                        .trim();
                                  return clean || '--';
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-lg w-full bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 flex justify-between items-center border-b dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white">صورة الحضور</h3>
              <button onClick={() => setSelectedImage(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <div className="p-4 flex justify-center bg-slate-50 dark:bg-slate-900">
              <img src={selectedImage} alt="لقطة الحضور" className="max-w-full rounded-xl shadow-md border border-slate-200 dark:border-slate-700" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
