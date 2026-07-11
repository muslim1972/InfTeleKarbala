import { useState, useEffect, useMemo, useCallback } from 'react';
import { timesheetService } from '../services/timesheetService';
import { computeWorkedMinutes, formatDurationArabic } from '../utils/attendanceCalc';
import { Calendar, ChevronDown, ChevronUp, FileSpreadsheet, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { toast } from 'react-hot-toast';
import { EmployeeSearch } from '../../../components/shared/EmployeeSearch';

export default function Timesheets() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [departmentId, setDepartmentId] = useState('all');
  const [employeeId, setEmployeeId] = useState('all');
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [workSchedules, setWorkSchedules] = useState<any[]>([]);

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

  // Group records by employee
  const groupedData = useMemo(() => {
    const groups: Record<string, { employee: any, records: any[], totalMins: number, lateCount: number, absenceCount: number }> = {};
    
    records.forEach(rec => {
      const empId = rec.employee_id;
      if (!groups[empId]) {
        groups[empId] = {
          employee: rec.employee,
          records: [],
          totalMins: 0,
          lateCount: 0,
          absenceCount: 0
        };
      }
      
      groups[empId].records.push(rec);
      const scheduleId = rec.work_schedule_id || rec.employee?.work_schedule_id;
      const expectedCheckout = getExpectedCheckoutTime(scheduleId, rec.check_in);
      groups[empId].totalMins += computeWorkedMinutes(rec, undefined, expectedCheckout);
      if (rec.status === 'late') groups[empId].lateCount++;
      if (rec.status === 'absent') groups[empId].absenceCount++;
    });

    return Object.values(groups).sort((a, b) => a.employee.full_name.localeCompare(b.employee.full_name));
  }, [records]);

  const exportToExcel = async () => {
    if (groupedData.length === 0) return toast.error('لا يوجد بيانات للتصدير');
    
    const toastId = toast.loading('جاري تجهيز الملف وتصدير الصور... يرجى الانتظار');
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Timesheets', { views: [{ rightToLeft: true }] });

      sheet.columns = [
        { header: 'اسم الموظف', key: 'name', width: 25 },
        { header: 'الرقم الوظيفي', key: 'job_number', width: 15 },
        { header: 'التاريخ', key: 'date', width: 25 },
        { header: 'نوع الدوام', key: 'shift_type', width: 20 },
        { header: 'صورة الدخول', key: 'check_in_image', width: 15 },
        { header: 'صورة الخروج', key: 'check_out_image', width: 15 },
        { header: 'الدخول', key: 'check_in', width: 15 },
        { header: 'الخروج', key: 'check_out', width: 15 },
        { header: 'استراحة ز.', key: 'break_time', width: 20 },
        { header: 'المدة الصافية', key: 'net_time', width: 20 },
        { header: 'ملاحظات', key: 'notes', width: 30 },
        { header: 'الحالة', key: 'status', width: 15 },
      ];

      sheet.getRow(1).font = { bold: true, size: 12 };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

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

      for (const group of groupedData) {
        const topRow = sheet.addRow({
          name: group.employee.full_name,
          job_number: group.employee.job_number,
          date: '',
          shift_type: '',
          check_in_image: '',
          check_out_image: '',
          check_in: '',
          check_out: '',
          break_time: '',
          net_time: '',
          notes: '',
          status: ''
        });
        topRow.font = { bold: true, color: { argb: 'FF1E40AF' } };
        topRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

        for (const rec of group.records) {
          const dateObj = parseISO(rec.check_in);
          const dateStr = format(dateObj, 'EEEE, d MMMM', { locale: arSA });
          const inTime = format(dateObj, 'HH:mm');
          const isPastDay = dateObj.toDateString() !== new Date().toDateString();
          const isForgotCheckout = !rec.check_out && isPastDay;
          const scheduleId = rec.work_schedule_id || group.employee.work_schedule_id;
          const expectedCheckout = getExpectedCheckoutTime(scheduleId, rec.check_in);
          const outTime = rec.check_out 
            ? format(parseISO(rec.check_out), 'HH:mm') 
            : (isForgotCheckout ? expectedCheckout : '--:--');

          const scheduleName = scheduleId 
            ? workSchedules.find(s => s.id === scheduleId)?.name || 'مخصص' 
            : (workSchedules.find(s => s.is_default)?.name || 'الجدول الافتراضي');

          const leaveStr = (rec.time_leave_out && rec.time_leave_return) 
            ? `${format(parseISO(rec.time_leave_out),'HH:mm')} - ${format(parseISO(rec.time_leave_return),'HH:mm')}`
            : '--';
          const netMins = computeWorkedMinutes(rec, undefined, expectedCheckout);
          
          const recordRow = sheet.addRow({
            name: '',
            job_number: '',
            date: dateStr,
            shift_type: scheduleName,
            check_in_image: '',
            check_out_image: '',
            check_in: inTime,
            check_out: outTime,
            break_time: leaveStr,
            net_time: formatDurationArabic(netMins),
            notes: rec.notes || '',
            status: rec.status === 'present' ? 'حاضر' : rec.status === 'late' ? 'متأخر' : rec.status
          });

          if (isForgotCheckout || rec.is_auto_check_out) {
            recordRow.getCell('check_out').font = { color: { argb: 'FFE11D48' }, bold: true };
          }

          // Fetch and embed images
          const embedImage = async (url: string, col: number) => {
            try {
              const base64 = await urlToBase64Png(url);
              const imageId = workbook.addImage({
                base64: base64,
                extension: 'png',
              });
              sheet.addImage(imageId, {
                tl: { col: col - 1, row: recordRow.number - 1 },
                ext: { width: 50, height: 50 },
                editAs: 'oneCell',
                hyperlinks: {
                  hyperlink: url,
                  tooltip: 'انقر لفتح الصورة الأصلية'
                }
              } as any);
              recordRow.getCell(col).value = { text: ' ', hyperlink: url };
              recordRow.height = 40;
            } catch (err) {
              console.error('Image load fail:', err);
              recordRow.getCell(col).value = { text: 'رابط الصورة', hyperlink: url };
            }
          };

          if (rec.check_in_snapshot_url) await embedImage(rec.check_in_snapshot_url, 5);
          if (rec.check_out_snapshot_url) await embedImage(rec.check_out_snapshot_url, 6);
        }

        const sumRow = sheet.addRow({
          name: '',
          job_number: '',
          date: `إجمالي: ${(group.totalMins / 60).toFixed(2)} ساعة`,
          shift_type: '',
          check_in_image: '',
          check_out_image: '',
          check_in: `تأخير: ${group.lateCount}`,
          check_out: `غياب: ${group.absenceCount}`,
          break_time: '',
          net_time: '',
          notes: '',
          status: ''
        });
        sumRow.font = { bold: true, color: { argb: 'FF1E40AF' } };
        sumRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
        
        sheet.addRow({});
      }

      // حماية الشيت (للقراءة فقط) برقم سري بسيط يمكن لمدير النظام فكه إذا لزم الأمر
      await sheet.protect('123456', {
        selectLockedCells: true,
        selectUnlockedCells: true,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const lastDay = new Date(year, month, 0).getDate();
      a.download = `جدول الحضور والانصراف العام من 1-${month}-${year} الى ${lastDay}-${month}-${year}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('تم تصدير الملف بنجاح', { id: toastId });
    } catch (err: any) {
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

        <button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap text-sm font-medium">
          <FileSpreadsheet className="w-4 h-4" />
          تصدير Excel
        </button>
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
            <div key={group.employee.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm transition-all">
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
                
                <div className="hidden md:flex gap-8 text-center items-center">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">صافي ساعات العمل</div>
                    <div className="font-bold text-emerald-600">{formatDurationArabic(group.totalMins)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">مرات التأخير</div>
                    <div className="font-bold text-rose-600">{group.lateCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">أيام الغياب</div>
                    <div className="font-bold text-slate-600 dark:text-slate-400">{group.absenceCount}</div>
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
                          <th className="px-4 py-3 rounded-r-lg">التاريخ</th>
                          <th className="px-4 py-3">نوع الدوام</th>
                          <th className="px-4 py-2 text-center">
                            <div>الصور</div>
                            <div className="flex justify-center gap-8 mt-1 text-[10px] font-bold uppercase tracking-widest">
                              <span className="text-emerald-500">IN</span>
                              <span className="text-teal-500">OUT</span>
                            </div>
                          </th>
                          <th className="px-4 py-3">الدخول</th>
                          <th className="px-4 py-3">الخروج</th>
                          <th className="px-4 py-3">استراحة ز.</th>
                          <th className="px-4 py-3">المدة الصافية</th>
                          <th className="px-4 py-3">ملاحظات</th>
                          <th className="px-4 py-3 rounded-l-lg">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.records.map(rec => {
                          const dateObj = parseISO(rec.check_in);
                          const dateStr = format(dateObj, 'EEEE, d MMMM', { locale: arSA });
                          const inTime = format(dateObj, 'HH:mm');
                          const isPastDay = dateObj.toDateString() !== new Date().toDateString();
                          const isForgotCheckout = !rec.check_out && isPastDay;
                          const scheduleId = rec.work_schedule_id || group.employee.work_schedule_id;
                          const expectedCheckout = getExpectedCheckoutTime(scheduleId, rec.check_in);
                          const outTime = rec.check_out 
                            ? format(parseISO(rec.check_out), 'HH:mm') 
                            : (isForgotCheckout ? expectedCheckout : '--:--');
                          
                          const scheduleName = scheduleId 
                            ? workSchedules.find(s => s.id === scheduleId)?.name || 'مخصص' 
                            : (workSchedules.find(s => s.is_default)?.name || 'الجدول الافتراضي');

                          const leaveStr = (rec.time_leave_out && rec.time_leave_return) 
                            ? `${format(parseISO(rec.time_leave_out),'HH:mm')} - ${format(parseISO(rec.time_leave_return),'HH:mm')}`
                            : '--';
                          const netMins = computeWorkedMinutes(rec, undefined, expectedCheckout);
                          const unverified = rec.notes && (
                            rec.notes.includes('الكاميرا') ||
                            rec.notes.includes('وجه') ||
                            rec.notes.includes('خلل') ||
                            rec.notes.includes('فشل') ||
                            rec.notes.includes('بدون')
                          );

                          return (
                            <tr key={rec.id} className={rec.is_device_pending ? "bg-red-50/70 dark:bg-red-950/20 hover:bg-red-100/70 dark:hover:bg-red-950/30" : "border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-white dark:hover:bg-slate-800 transition-colors"}>
                              <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{dateStr}</td>
                              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-xs">{scheduleName}</span>
                              </td>
                              <td className="px-2 py-2 min-w-[120px]">
                                <div className="flex items-center justify-center gap-2">
                                  {rec.check_in_snapshot_url ? (
                                    <div role="button" tabIndex={0} onClick={() => setSelectedImage(rec.check_in_snapshot_url!)} className="relative group overflow-hidden rounded-md border-2 border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all w-14 h-14 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-sm cursor-pointer block" title="تكبير صورة الدخول">
                                      <img src={rec.check_in_snapshot_url} alt="دخول" className="w-full h-full object-cover md:group-hover:scale-110 transition-transform duration-300 pointer-events-none block" loading="lazy" />
                                    </div>
                                  ) : (
                                    <div className="w-14 h-14 shrink-0 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700" />
                                  )}
                                  
                                  {rec.check_out_snapshot_url ? (
                                    <div role="button" tabIndex={0} onClick={() => setSelectedImage(rec.check_out_snapshot_url!)} className="relative group overflow-hidden rounded-md border-2 border-teal-100 dark:border-teal-900/30 hover:border-teal-500 dark:hover:border-teal-500 transition-all w-14 h-14 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-sm cursor-pointer block" title="تكبير صورة الخروج">
                                      <img src={rec.check_out_snapshot_url} alt="خروج" className="w-full h-full object-cover md:group-hover:scale-110 transition-transform duration-300 pointer-events-none block" loading="lazy" />
                                    </div>
                                  ) : (
                                    <div className="w-14 h-14 shrink-0 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700" />
                                  )}
                                </div>
                              </td>
                              <td className={`px-4 py-3 font-mono ${unverified ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>{inTime}</td>
                              <td className={`px-4 py-3 font-mono ${isForgotCheckout || unverified ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>{outTime}</td>
                              <td className="px-4 py-3 text-amber-600 font-mono">{leaveStr}</td>
                              <td className="px-4 py-3 font-bold text-blue-600">{formatDurationArabic(netMins)}</td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                {rec.is_device_pending ? <span className="text-red-600 dark:text-red-400 font-bold block mb-1">⚠️ جهاز غير معتمد</span> : null}
                                {rec.notes || '--'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  rec.is_device_pending ? 'bg-red-100 text-red-800 border border-red-200' :
                                  rec.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                                  rec.status === 'late' ? 'bg-rose-100 text-rose-800' :
                                  'bg-slate-100 text-slate-800'
                                }`}>
                                  {rec.is_device_pending ? 'معلق (جهاز جديد)' : rec.status === 'present' ? 'حاضر' : rec.status === 'late' ? 'متأخر' : rec.status}
                                </span>
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
