import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { timesheetService } from '../services/timesheetService';
import { computeWorkedMinutes, formatDurationArabic, formatDurationDot, computeDeficitMinutes, computeOvertimeMinutes } from '../utils/attendanceCalc';
import { Calendar, ChevronDown, ChevronUp, FileSpreadsheet, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';
import html2pdf from 'html2pdf.js';
import { toast } from 'react-hot-toast';
import { EmployeeSearch } from '../../../components/shared/EmployeeSearch';
import { smoothScrollToId } from '../../../hooks/useSmoothScroll';
import ExcelJS from 'exceljs';

export default function Timesheets() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [departmentId, setDepartmentId] = useState('all');
  const [employeeId, setEmployeeId] = useState('all');
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const pdfMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(event.target as Node)) {
        setShowPdfMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
  }, [year, month, departmentId, employeeId]);

  const loadFilters = async () => {
    try {
      const deps = await timesheetService.getDepartments();
      setDepartments(deps);
      
      const schedules = await timesheetService.getWorkSchedules();
      setWorkSchedules(schedules);

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
    } catch (err: any) {
      toast.error('فشل تحميل التقارير: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getExpectedCheckoutTime = useCallback((empScheduleId: string | undefined, dateStr: string) => {
    const defaultSchedule = workSchedules.find(s => s.is_default) || workSchedules[0];
    const schedule = empScheduleId ? workSchedules.find(s => s.id === empScheduleId) : defaultSchedule;
    if (!schedule) return '15:00';
    
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); 
    
    const daySchedule = schedule.days?.find((d: any) => d.day_of_week === dayOfWeek);
    
    // If the specific day has an end time, use it
    if (daySchedule && !daySchedule.is_rest_day && daySchedule.end_time) {
      return daySchedule.end_time.substring(0, 5); 
    }
    
    // If they checked in on a rest day or the day has no specific end time,
    // fallback to the first available working day's end time in their schedule!
    const anyWorkingDay = schedule.days?.find((d: any) => !d.is_rest_day && d.end_time);
    if (anyWorkingDay) {
      return anyWorkingDay.end_time.substring(0, 5);
    }
    
    return '15:00';
  }, [workSchedules]);

  const getExpectedCheckinTime = useCallback((empScheduleId: string | undefined, dateStr: string) => {
    const defaultSchedule = workSchedules.find(s => s.is_default) || workSchedules[0];
    const schedule = empScheduleId ? workSchedules.find(s => s.id === empScheduleId) : defaultSchedule;
    if (!schedule) return '08:00';
    
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); 
    
    const daySchedule = schedule.days?.find((d: any) => d.day_of_week === dayOfWeek);
    if (daySchedule && !daySchedule.is_rest_day && daySchedule.start_time) {
      return daySchedule.start_time.substring(0, 5); 
    }
    
    const anyWorkingDay = schedule.days?.find((d: any) => !d.is_rest_day && d.start_time);
    if (anyWorkingDay) {
      return anyWorkingDay.start_time.substring(0, 5);
    }
    
    return '08:00';
  }, [workSchedules]);

  const getDayTypeStr = useCallback((dateObj: Date, schedule: any) => {
    const dateOnly = format(dateObj, 'yyyy-MM-dd');
    const holiday = globalHolidays.find(h => dateOnly >= h.start_date && dateOnly <= h.end_date);
    if (holiday) return `عطلة: ${holiday.name}`;

    const dayNameEng = format(dateObj, 'EEEE');
    if (globalSettings?.weekend_days?.includes(dayNameEng)) {
       return 'عطلة';
    }

    if (schedule) {
       const dayOfWeek = dateObj.getDay();
       const daySchedule = schedule.days?.find((d: any) => d.day_of_week === dayOfWeek);
       if (daySchedule && daySchedule.is_rest_day) {
          return 'عطلة';
       }
    }
    return 'يوم عمل';
  }, [globalHolidays, globalSettings]);

  const groupedData = useMemo(() => {
    const groups: Record<string, { employee: any, records: any[], totalWorkMins: number, totalDeficit: number, totalOvertime: number, lateCount: number, absenceCount: number }> = {};
    
    records.forEach(rec => {
      const empId = rec.employee_id;
      if (!groups[empId]) {
        groups[empId] = {
          employee: rec.employee,
          records: [],
          totalWorkMins: 0,
          totalDeficit: 0,
          totalOvertime: 0,
          lateCount: 0,
          absenceCount: 0
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
       
       for (let day = 1; day <= 31; day++) {
           if (day <= daysInMonth) {
               if (recordsByDay[day] && recordsByDay[day].length > 0) {
                   newRecords.push(recordsByDay[day][0]); // 1 record per day per employee
               } else {
                   const fakeDate = new Date(year, month - 1, day, 12, 0, 0).toISOString();
                   newRecords.push({
                       _isEmpty: true,
                       check_in: fakeDate,
                       status: 'absent'
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
  }, [records, getExpectedCheckoutTime, getExpectedCheckinTime, year, month]);

  const exportToPDF = async (includeImages: boolean = true) => {
    if (groupedData.length === 0) return toast.error('لا يوجد بيانات للتصدير');
    
    const toastId = toast.loading('جاري تجهيز الملف وتصدير الصور كـ PDF... يرجى الانتظار');
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

      const lastDay = new Date(year, month, 0).getDate();
      const printDate = new Date().toLocaleDateString('en-GB');

      let html = `
        <div style="direction: rtl; font-family: 'Amiri', 'Cairo', 'Segoe UI', Tahoma, serif; color: black; background: white; width: 1030px; margin: 0 auto; padding: 0 10px; box-sizing: border-box;">
      `;

      for (let i = 0; i < groupedData.length; i++) {
        const group = groupedData[i];
        const pageBreakStyle = i > 0 ? 'page-break-before: always; padding-top: 10px;' : '';

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

            <table style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: center; margin-bottom: 6px;">
              <thead>
                <tr style="background-color: #f3f4f6; color: #111827; border-bottom: 1px solid #d1d5db;">
                  <th style="padding: 2px; border: 1px solid #d1d5db;">التاريخ واليوم</th>
                  <th style="padding: 2px; border: 1px solid #d1d5db;">نوع اليوم</th>
                  <th style="padding: 2px; border: 1px solid #d1d5db;">التحقق</th>
                  <th style="padding: 2px; border: 1px solid #d1d5db;">الدوام</th>
                  ${includeImages ? `
                  <th style="padding: 2px; border: 1px solid #d1d5db;">ص. دخول</th>
                  <th style="padding: 2px; border: 1px solid #d1d5db;">ص. خروج</th>
                  ` : ''}
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
                  <th style="padding: 2px; border: 1px solid #d1d5db;">الملاحظات</th>
                </tr>
              </thead>
              <tbody>
        `;

        const tdStyle = "padding: 1px 2px; border: 1px solid #d1d5db; height: 16px;";

        for (const rec of group.records) {
          if (rec._isPadding) {
             html += `<tr>`;
             for(let c=0; c<(includeImages ? 17 : 15); c++) {
                 html += `<td style="${tdStyle}">&nbsp;</td>`;
             }
             html += `</tr>`;
             continue;
          }
          const dateStrRaw = rec.check_in ? rec.check_in : new Date(year, month - 1, 1).toISOString();
          const dateObj = parseISO(dateStrRaw);
          const dateStr = format(dateObj, 'EEEE, d MMMM', { locale: arSA });
          
          if (rec._isEmpty) {
             html += `<tr>`;
             html += `<td style="${tdStyle} white-space: nowrap;">${dateStr}</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             if (includeImages) {
                 html += `<td style="${tdStyle}">--</td>`;
                 html += `<td style="${tdStyle}">--</td>`;
             }
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle}">--</td>`;
             html += `<td style="${tdStyle} color: #999;">لا توجد بصمات</td>`;
             html += `</tr>`;
             continue;
          }
          const inTime = rec.check_in ? format(parseISO(rec.check_in), 'HH:mm') : '--:--';
          const isPastDay = dateObj.toDateString() !== new Date().toDateString();
          const isForgotCheckout = !rec.check_out && isPastDay && rec.check_in;
          
          const scheduleId = rec.work_schedule_id || group.employee.work_schedule_id;
          const expectedCheckout = getExpectedCheckoutTime(scheduleId, dateStrRaw);
          const expectedCheckin = getExpectedCheckinTime(scheduleId, dateStrRaw);
          
          const outTime = rec.check_out 
            ? format(parseISO(rec.check_out), 'HH:mm') 
            : (isForgotCheckout ? expectedCheckout : '--:--');

          let scheduleName = 'الجدول الافتراضي';
          const schedule = scheduleId ? workSchedules.find(s => s.id === scheduleId) : (workSchedules.find(s => s.is_default) || workSchedules[0]);
          let dayType = getDayTypeStr(dateObj, schedule);
          
          if (schedule) {
             scheduleName = schedule.name;
          }

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
          
          let checkInImgHtml = '-';
          if (includeImages && rec.check_in_snapshot_url) {
            try {
               const b64 = await urlToBase64Png(rec.check_in_snapshot_url);
               const viewerUrl = `${window.location.origin}/image-viewer.html?url=${encodeURIComponent(rec.check_in_snapshot_url)}`;
               checkInImgHtml = `<a href="${viewerUrl}" target="_blank"><img src="${b64}" style="width: 25px; height: 25px; border-radius: 4px; object-fit: cover; border: 1px solid #ccc;" /></a>`;
            } catch (e) {
               const viewerUrl = `${window.location.origin}/image-viewer.html?url=${encodeURIComponent(rec.check_in_snapshot_url)}`;
               checkInImgHtml = `<a href="${viewerUrl}" target="_blank" style="color: blue; text-decoration: underline;">رابط</a>`;
            }
          }

          let checkOutImgHtml = '-';
          if (includeImages && rec.check_out_snapshot_url) {
             try {
               const b64 = await urlToBase64Png(rec.check_out_snapshot_url);
               const viewerUrl = `${window.location.origin}/image-viewer.html?url=${encodeURIComponent(rec.check_out_snapshot_url)}`;
               checkOutImgHtml = `<a href="${viewerUrl}" target="_blank"><img src="${b64}" style="width: 25px; height: 25px; border-radius: 4px; object-fit: cover; border: 1px solid #ccc;" /></a>`;
            } catch (e) {
               const viewerUrl = `${window.location.origin}/image-viewer.html?url=${encodeURIComponent(rec.check_out_snapshot_url)}`;
               checkOutImgHtml = `<a href="${viewerUrl}" target="_blank" style="color: blue; text-decoration: underline;">رابط</a>`;
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
              ${includeImages ? `
              <td style="${tdStyle}">${checkInImgHtml}</td>
              <td style="${tdStyle}">${checkOutImgHtml}</td>
              ` : ''}
              <td style="${tdStyle} ${inTimeColor}">${inTime}</td>
              <td style="${tdStyle}">${leaveOutStr}</td>
              <td style="${tdStyle}">${leaveReturnStr}</td>
              <td style="${tdStyle}">${leaveOut2Str}</td>
              <td style="${tdStyle}">${leaveReturn2Str}</td>
              <td style="${tdStyle} ${outTimeColor}">${outTime}</td>
              <td style="${tdStyle}">${formatDurationDot(netMins)}</td>
              <td style="${tdStyle} ${deficitColor}">${deficitMins > 0 ? formatDurationDot(deficitMins) : '--'}</td>
              <td style="${tdStyle} ${overtimeColor}">${overtimeMins > 0 ? formatDurationDot(overtimeMins) : '--'}</td>
              <td style="${tdStyle}">${rec.status === 'present' ? 'حاضر' : rec.status === 'late' ? 'متأخر' : rec.status === 'absent' ? 'غائب' : rec.status}</td>
              <td style="${tdStyle} font-size: 8px;">${rec.notes || ''}</td>
            </tr>
          `;
        }

        html += `
                <tr style="background-color: #f8fafc; font-weight: bold;">
                  <td colspan="${includeImages ? 17 : 15}" style="padding: 4px; border: 1px solid #d1d5db; text-align: left; color: #334155;">
                    إجمالي الصافي: ${formatDurationDot(group.totalWorkMins)} | 
                    إجمالي النقص: ${formatDurationDot(group.totalDeficit)} | 
                    إجمالي الإضافي: ${formatDurationDot(group.totalOvertime)} | 
                    تأخير: ${group.lateCount} | غياب: ${group.absenceCount}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
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

  const exportToExcel = async () => {
    if (groupedData.length === 0) return toast.error('لا يوجد بيانات للتصدير');
    
    const toastId = toast.loading('جاري تصدير الملف... يرجى الانتظار');
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

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('تقارير البصمة');
      worksheet.views = [{ rightToLeft: true }];
        
      worksheet.columns = [
        { key: 'date', width: 22 },
        { key: 'dayType', width: 12 },
        { key: 'verify', width: 10 },
        { key: 'schedule', width: 15 },
        { key: 'photo_in', width: 10 },
        { key: 'photo_out', width: 10 },
        { key: 'check_in', width: 10 },
        { key: 'leave_out', width: 10 },
        { key: 'leave_return', width: 10 },
        { key: 'leave_out_2', width: 10 },
        { key: 'leave_return_2', width: 10 },
        { key: 'check_out', width: 10 },
        { key: 'net', width: 10 },
        { key: 'deficit', width: 10 },
        { key: 'overtime', width: 10 },
        { key: 'status', width: 10 },
        { key: 'notes', width: 25 },
      ];

      for (let i = 0; i < groupedData.length; i++) {
        const group = groupedData[i];

        // Add spacing between employees
        if (i > 0) {
            worksheet.addRow([]);
            worksheet.addRow([]);
        }

        // Add Employee Name Row
        const titleRow = worksheet.addRow([`${group.employee.full_name} (${group.employee.job_number || 'بدون رقم وظيفي'})`]);
        worksheet.mergeCells(`A${titleRow.number}:J${titleRow.number}`);
        titleRow.getCell(1).font = { name: 'Cairo', bold: true, size: 14, color: { argb: 'FF0369A1' } };
        titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
        titleRow.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        // Add Table Headers
        const headerRow = worksheet.addRow([
            'التاريخ واليوم', 'نوع اليوم', 'التحقق', 'الدوام', 'ص. دخول', 'ص. خروج', 'دخول', 'ب. راحة 1', 'ع. راحة 1', 'ب. راحة 2', 'ع. راحة 2', 'خروج', 'الصافي', 'النقص', 'الإضافي', 'الحالة', 'ملاحظات'
        ]);
        
        headerRow.eachCell((cell) => {
            cell.font = { name: 'Cairo', bold: true, size: 12, color: { argb: 'FF111827' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin' } };
        });

        for (const rec of group.records) {
            if (rec._isPadding) {
                worksheet.addRow([]);
                continue;
            }
            const dateStrRaw = rec.check_in ? rec.check_in : new Date(year, month - 1, 1).toISOString();
            const dateObj = parseISO(dateStrRaw);
            const dateStr = format(dateObj, 'EEEE, d MMMM', { locale: arSA });
            
            if (rec._isEmpty) {
                worksheet.addRow({
                   date: dateStr,
                   notes: 'لا توجد بصمات'
                });
                continue;
            }

            const isPastDay = dateObj.toDateString() !== new Date().toDateString();
            const isForgotCheckout = !rec.check_out && isPastDay && rec.check_in;
            const scheduleId = rec.work_schedule_id || rec.employee?.work_schedule_id;
            const expectedCheckout = getExpectedCheckoutTime(scheduleId, dateStrRaw);
            const expectedCheckin = getExpectedCheckinTime(scheduleId, dateStrRaw);
            
            let scheduleName = 'الجدول الافتراضي';
            const schedule = scheduleId ? workSchedules.find(s => s.id === scheduleId) : (workSchedules.find(s => s.is_default) || workSchedules[0]);
            let dayType = getDayTypeStr(dateObj, schedule);
            
            if (schedule) {
               scheduleName = schedule.name;
               const dayOfWeek = dateObj.getDay();
               const daySchedule = schedule.days?.find((d: any) => d.day_of_week === dayOfWeek);
               if (daySchedule && daySchedule.is_rest_day) dayType = 'عطلة';
            }

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

            const statusLabel = 
                rec.status === 'present' ? 'حاضر' :
                rec.status === 'late' ? 'متأخر' :
                rec.status === 'absent' ? 'غائب' : 'غير مكتمل';
            
            const checkInStr = rec.check_in ? format(parseISO(rec.check_in), 'HH:mm') : '--:--';
            const checkOutStr = rec.check_out 
              ? format(parseISO(rec.check_out), 'HH:mm') 
              : (isForgotCheckout ? expectedCheckout : '--:--');
            
            const outTimeColor = (isForgotCheckout || rec.is_auto_check_out) ? 'FFDC2626' : undefined;
            const inTimeColor = rec.status === 'late' ? 'FFDC2626' : undefined;
            const deficitColor = deficitMins > 0 ? 'FFDC2626' : undefined;
            const overtimeColor = overtimeMins > 0 ? 'FF059669' : undefined;

            let checkInImgId: number | undefined;
            if (rec.check_in_snapshot_url) {
                try {
                    const b64 = await urlToBase64Png(rec.check_in_snapshot_url);
                    checkInImgId = workbook.addImage({ base64: b64.split(',')[1], extension: 'png' });
                } catch(e) {}
            }

            let checkOutImgId: number | undefined;
            if (rec.check_out_snapshot_url) {
                try {
                    const b64 = await urlToBase64Png(rec.check_out_snapshot_url);
                    checkOutImgId = workbook.addImage({ base64: b64.split(',')[1], extension: 'png' });
                } catch(e) {}
            }

            const row = worksheet.addRow({
                date: dateStr,
                dayType: dayType,
                verify: verifyMethod,
                schedule: scheduleName,
                photo_in: '', // Will add image overlay
                photo_out: '', // Will add image overlay
                check_in: checkInStr,
                leave_out: leaveOutStr,
                leave_return: leaveReturnStr,
                leave_out_2: leaveOut2Str,
                leave_return_2: leaveReturn2Str,
                check_out: checkOutStr,
                net: formatDurationDot(netMins),
                deficit: deficitMins > 0 ? formatDurationDot(deficitMins) : '--',
                overtime: overtimeMins > 0 ? formatDurationDot(overtimeMins) : '--',
                status: statusLabel,
                notes: rec.notes || ''
            });

            // Set row height for images
            row.height = 42;

            if (checkInImgId !== undefined && rec.check_in_snapshot_url) {
                const viewerUrl = `${window.location.origin}/image-viewer.html?url=${encodeURIComponent(rec.check_in_snapshot_url)}`;
                row.getCell('photo_in').value = { text: ' ', hyperlink: viewerUrl };
                
                worksheet.addImage(checkInImgId, {
                    tl: { col: 4.15, row: row.number - 0.9 },
                    ext: { width: 45, height: 45 },
                    editAs: 'oneCell',
                    hyperlinks: {
                        hyperlink: viewerUrl,
                        tooltip: 'انقر لعرض الصورة'
                    }
                } as any);
            }

            if (checkOutImgId !== undefined && rec.check_out_snapshot_url) {
                const viewerUrl = `${window.location.origin}/image-viewer.html?url=${encodeURIComponent(rec.check_out_snapshot_url)}`;
                row.getCell('photo_out').value = { text: ' ', hyperlink: viewerUrl };
                
                worksheet.addImage(checkOutImgId, {
                    tl: { col: 5.15, row: row.number - 0.9 },
                    ext: { width: 45, height: 45 },
                    editAs: 'oneCell',
                    hyperlinks: {
                        hyperlink: viewerUrl,
                        tooltip: 'انقر لعرض الصورة'
                    }
                } as any);
            }

            row.eachCell((cell, colNumber) => {
                cell.font = { name: 'Cairo', size: 11 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
                
                if (colNumber === 7 && inTimeColor) {
                    cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: inTimeColor } };
                }
                if (colNumber === 10 && outTimeColor) {
                    cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: outTimeColor } };
                }
                if (colNumber === 12 && deficitColor) {
                    cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: deficitColor } };
                }
                if (colNumber === 13 && overtimeColor) {
                    cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: overtimeColor } };
                }
                if (colNumber === 14) {
                    if (statusLabel === 'حاضر') cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FF059669' } };
                    else if (statusLabel === 'متأخر') cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFD97706' } };
                    else if (statusLabel === 'غائب') cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFDC2626' } };
                }
            });
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقارير_البصمة_${year}_${month}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
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
          <div className="relative" ref={pdfMenuRef}>
            <button 
              onClick={() => setShowPdfMenu(!showPdfMenu)} 
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap text-sm font-medium"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تصدير PDF
              <ChevronDown className="w-4 h-4 mr-1" />
            </button>
            {showPdfMenu && (
              <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-48 overflow-hidden z-20">
                <button 
                  onClick={() => { setShowPdfMenu(false); exportToPDF(true); }}
                  className="w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700 last:border-0"
                >
                  تصدير PDF (مع الصور)
                </button>
                <button 
                  onClick={() => { setShowPdfMenu(false); exportToPDF(false); }}
                  className="w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  تصدير PDF (بدون صور)
                </button>
              </div>
            )}
          </div>
          <button onClick={exportToExcel} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap text-sm font-medium">
            <FileSpreadsheet className="w-4 h-4" />
            تصدير Excel
          </button>
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
                  <div className="text-slate-400">
                    {expandedEmp === group.employee.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
                          const dateStr = format(dateObj, 'EEEE, d MMMM', { locale: arSA });
                          
                          if (rec._isEmpty) {
                              return (
                                  <tr key={`empty-${i}`} className="border-b border-slate-100 dark:border-slate-800">
                                      <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-300">{dateStr}</td>
                                      <td colSpan={15} className="px-3 py-3 text-sm text-center text-slate-500">لا توجد بصمات</td>
                                  </tr>
                              );
                          }
                          const inTime = rec.check_in ? format(parseISO(rec.check_in), 'HH:mm') : '--:--';
                          const isPastDay = dateObj.toDateString() !== new Date().toDateString();
                          const isForgotCheckout = !rec.check_out && isPastDay && rec.check_in;
                          const scheduleId = rec.work_schedule_id || group.employee.work_schedule_id;
                          const expectedCheckout = getExpectedCheckoutTime(scheduleId, dateStrRaw);
                          const expectedCheckin = getExpectedCheckinTime(scheduleId, dateStrRaw);
                          
                          const outTime = rec.check_out 
                            ? format(parseISO(rec.check_out), 'HH:mm') 
                            : (isForgotCheckout ? expectedCheckout : '--:--');
                          
                          let scheduleName = 'الجدول الافتراضي';
                          const schedule = scheduleId ? workSchedules.find(s => s.id === scheduleId) : (workSchedules.find(s => s.is_default) || workSchedules[0]);
                          let dayType = getDayTypeStr(dateObj, schedule);
                          
                          if (schedule) {
                             scheduleName = schedule.name;
                          }

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
                              <td className={`px-3 py-3 font-mono ${unverified ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>{inTime}</td>
                              <td className="px-3 py-3 text-amber-600 font-mono">{leaveOutStr}</td>
                              <td className="px-3 py-3 text-amber-600 font-mono">{leaveReturnStr}</td>
                              <td className="px-3 py-3 text-amber-600 font-mono">{leaveOut2Str}</td>
                              <td className="px-3 py-3 text-amber-600 font-mono">{leaveReturn2Str}</td>
                              <td className={`px-3 py-3 font-mono ${isForgotCheckout || unverified ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>{outTime}</td>
                              <td className="px-3 py-3 font-bold text-blue-600">{formatDurationDot(netMins)}</td>
                              <td className="px-3 py-3 font-bold text-rose-600">{deficitMins > 0 ? formatDurationDot(deficitMins) : '--'}</td>
                              <td className="px-3 py-3 font-bold text-emerald-600">{overtimeMins > 0 ? formatDurationDot(overtimeMins) : '--'}</td>
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
                                {rec.notes || '--'}
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
