import { useState, useEffect, useMemo } from 'react';
import { timesheetService } from '../services/timesheetService';
import { computeWorkedMinutes, formatDurationArabic } from '../utils/attendanceCalc';
import { Calendar, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { toast } from 'react-hot-toast';

export default function Timesheets() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [departmentId, setDepartmentId] = useState('all');
  const [employeeId, setEmployeeId] = useState('all');
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    if (departmentId !== 'all') {
      timesheetService.getEmployees(departmentId).then(setEmployees);
      setEmployeeId('all');
    } else {
      timesheetService.getEmployees().then(setEmployees);
    }
  }, [departmentId]);

  useEffect(() => {
    loadData();
  }, [year, month, departmentId, employeeId]);

  const loadFilters = async () => {
    try {
      const deps = await timesheetService.getDepartments();
      setDepartments(deps);
      const emps = await timesheetService.getEmployees();
      setEmployees(emps);
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
      groups[empId].totalMins += computeWorkedMinutes(rec);
      if (rec.status === 'late') groups[empId].lateCount++;
      if (rec.status === 'absent') groups[empId].absenceCount++;
    });

    return Object.values(groups).sort((a, b) => a.employee.full_name.localeCompare(b.employee.full_name));
  }, [records]);

  const exportToExcel = async () => {
    if (groupedData.length === 0) return toast.error('لا يوجد بيانات للتصدير');
    
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Timesheets', { views: [{ rightToLeft: true }] });

      sheet.columns = [
        { header: 'اسم الموظف', key: 'name', width: 25 },
        { header: 'الرقم الوظيفي', key: 'job_number', width: 15 },
        { header: 'إجمالي الساعات', key: 'total_hours', width: 15 },
        { header: 'مرات التأخير', key: 'late_count', width: 15 },
        { header: 'أيام الغياب', key: 'absent_count', width: 15 },
      ];

      // Add styling to header
      sheet.getRow(1).font = { bold: true, size: 12 };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      groupedData.forEach(group => {
        sheet.addRow({
          name: group.employee.full_name,
          job_number: group.employee.job_number,
          total_hours: (group.totalMins / 60).toFixed(2),
          late_count: group.lateCount,
          absent_count: group.absenceCount
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Timesheets_${year}_${month}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('فشل تصدير الملف: ' + err.message);
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
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">الموظف</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none w-48 dark:text-white">
              <option value="all">كل الموظفين</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
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
                          <th className="px-4 py-3">الدخول</th>
                          <th className="px-4 py-3">الخروج</th>
                          <th className="px-4 py-3">استراحة ز.</th>
                          <th className="px-4 py-3">المدة الصافية</th>
                          <th className="px-4 py-3 rounded-l-lg">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.records.map(rec => {
                          const dateObj = parseISO(rec.check_in);
                          const dateStr = format(dateObj, 'EEEE, d MMMM', { locale: arSA });
                          const inTime = format(dateObj, 'HH:mm');
                          const outTime = rec.check_out ? format(parseISO(rec.check_out), 'HH:mm') : '--:--';
                          const leaveStr = (rec.time_leave_out && rec.time_leave_return) 
                            ? `${format(parseISO(rec.time_leave_out),'HH:mm')} - ${format(parseISO(rec.time_leave_return),'HH:mm')}`
                            : '--';
                          const netMins = computeWorkedMinutes(rec);

                          return (
                            <tr key={rec.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{dateStr}</td>
                              <td className="px-4 py-3 text-emerald-600 font-mono">{inTime}</td>
                              <td className="px-4 py-3 text-rose-600 font-mono">{outTime}</td>
                              <td className="px-4 py-3 text-amber-600 font-mono">{leaveStr}</td>
                              <td className="px-4 py-3 font-bold text-blue-600">{formatDurationArabic(netMins)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  rec.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                                  rec.status === 'late' ? 'bg-rose-100 text-rose-800' :
                                  'bg-slate-100 text-slate-800'
                                }`}>
                                  {rec.status === 'present' ? 'حاضر' : rec.status === 'late' ? 'متأخر' : rec.status}
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
    </div>
  );
}
