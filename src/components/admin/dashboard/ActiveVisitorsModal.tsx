import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Calendar, 
  Users, 
  Printer,
  FileSpreadsheet, 
  Loader2, 
  Building2, 
  AlertCircle,
  Smartphone,
  Globe,
  Filter,
  ChevronDown,
  Check,
  UserCheck,
  UserX,
  Clock
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import { getSmartTripleName, formatWorkplaceHierarchy } from '../../../utils/profileUtils';

interface VisitorRecord {
  user_id: string;
  full_name: string;
  dept_text?: string | null;
  section_text?: string | null;
  unit_text?: string | null;
  workplace: string;
  last_login_at: string;
  visit_count: number;
  is_pwa?: boolean;
}

interface InactiveRecord {
  user_id: string;
  full_name: string;
  dept_text?: string | null;
  section_text?: string | null;
  unit_text?: string | null;
  workplace: string;
  last_seen_at?: string | null;
  visit_count: number;
  is_pwa?: boolean;
}

type TabType = 'active' | 'inactive';
type SortOption = 'date' | 'alpha' | 'workplace';

interface ActiveVisitorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  governorate: string;
}

const sortLabels: Record<SortOption, string> = {
  date: 'حسب التاريخ',
  alpha: 'حسب الحروف (أبجدياً)',
  workplace: 'حسب موقع العمل'
};

export const ActiveVisitorsModal: React.FC<ActiveVisitorsModalProps> = ({
  isOpen,
  onClose,
  theme,
  governorate
}) => {
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState<InactiveRecord[]>([]);
  const [totalStaff, setTotalStaff] = useState<number>(0);
  const [totalVisitors, setTotalVisitors] = useState<number>(0);
  const [inactiveCount, setInactiveCount] = useState<number>(0);
  const [pwaCount, setPwaCount] = useState<number>(0);
  const [browserCount, setBrowserCount] = useState<number>(0);

  // Tab & Sort states
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortMenu]);

  const fetchVisitors = useCallback(async (start: string, end: string) => {
    if (!start || !end) return;
    try {
      setLoading(true);
      setError(null);
      const { data, error: rpcErr } = await supabase.rpc('get_active_visitors_by_range', {
        p_start_date: start,
        p_end_date: end,
        p_governorate: governorate || 'karbala'
      });

      if (rpcErr) throw rpcErr;
      
      setVisitors(data?.visitors || []);
      setInactiveUsers(data?.inactive_users || []);
      setTotalStaff(data?.total_staff || 0);
      setTotalVisitors(data?.total_visitors || 0);
      setInactiveCount(data?.inactive_count || 0);
      setPwaCount(data?.pwa_count || 0);
      setBrowserCount(data?.browser_count || 0);
    } catch (err: any) {
      console.error('Error fetching visitors:', err);
      setError(err.message || 'حدث خطأ أثناء جلب قائمة المتصفحين');
    } finally {
      setLoading(false);
    }
  }, [governorate]);

  // Initial fetch when opened
  useEffect(() => {
    if (isOpen) {
      fetchVisitors(startDate, endDate);
    }
  }, [isOpen, startDate, endDate, fetchVisitors]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    setStartDate(newStart);
    if (endDate && newStart) {
      fetchVisitors(newStart, endDate);
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value;
    setEndDate(newEnd);
    if (startDate && newEnd) {
      fetchVisitors(startDate, newEnd);
    }
  };

  const govNameAr = governorate === 'babil' ? 'بابل' : governorate === 'najaf' ? 'النجف الأشرف' : 'كربلاء المقدسة';

  // Format date helper
  const formatDateShort = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${d.getFullYear()}/${month}/${day}`;
    } catch {
      return isoStr;
    }
  };

  const formatDateAr = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const dateStr = d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' });
      const timeStr = d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} (${timeStr})`;
    } catch {
      return isoStr;
    }
  };

  // Sorted list based on activeTab and sortBy
  const sortedList = useMemo(() => {
    if (activeTab === 'active') {
      const list = [...visitors];
      if (sortBy === 'alpha') {
        return list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
      }
      if (sortBy === 'workplace') {
        return list.sort((a, b) => 
          (a.workplace || '').localeCompare(b.workplace || '', 'ar') ||
          a.full_name.localeCompare(b.full_name, 'ar')
        );
      }
      // 'date' -> latest login first
      return list.sort((a, b) => 
        new Date(b.last_login_at).getTime() - new Date(a.last_login_at).getTime()
      );
    } else {
      const list = [...inactiveUsers];
      if (sortBy === 'alpha') {
        return list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
      }
      if (sortBy === 'workplace') {
        return list.sort((a, b) => 
          (a.workplace || '').localeCompare(b.workplace || '', 'ar') ||
          a.full_name.localeCompare(b.full_name, 'ar')
        );
      }
      // 'date' -> most recent last seen first, null (never logged in) at bottom
      return list.sort((a, b) => {
        const timeA = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
        const timeB = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return a.full_name.localeCompare(b.full_name, 'ar');
      });
    }
  }, [activeTab, visitors, inactiveUsers, sortBy]);

  const handlePrint = () => {
    const isAct = activeTab === 'active';
    const reportTitle = isAct 
      ? 'سجل المتصفحين والولوج الفعلي للتطبيق' 
      : 'سجل الموظفين غير المتفاعلين مع التطبيق';

    const rowsHtml = sortedList.map((item, idx) => {
      if (isAct) {
        const v = item as VisitorRecord;
        const d = new Date(v.last_login_at);
        const dateStr = d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
        const channelBadge = v.is_pwa 
          ? `<span style="background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 10.5px; display: inline-block; white-space: nowrap;">📱 تطبيق PWA</span>`
          : `<span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 10.5px; display: inline-block; white-space: nowrap;">🌐 متصفح ويب</span>`;

        const tripleName = getSmartTripleName(v.full_name);
        const displayWorkplace = v.workplace || formatWorkplaceHierarchy(v.dept_text, v.section_text, v.unit_text, govNameAr);

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
            <td style="padding: 7px 4px; text-align: center; color: #64748b; font-weight: bold; font-size: 11.5px;">${idx + 1}</td>
            <td style="padding: 7px 6px; font-weight: 700; color: #1e293b; white-space: nowrap;">${tripleName}</td>
            <td style="padding: 7px 6px; color: #1e293b; font-weight: 600; white-space: nowrap;">${displayWorkplace}</td>
            <td style="padding: 5px 4px; text-align: center; color: #0f172a; white-space: nowrap;">
              <div style="font-weight: 700; font-family: monospace; font-size: 11.5px;">${dateStr}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 1px;">${timeStr}</div>
            </td>
            <td style="padding: 6px 4px; text-align: center; white-space: nowrap;">
              ${channelBadge}
            </td>
          </tr>
        `;
      } else {
        const u = item as InactiveRecord;
        let lastActivityHtml = '';
        if (u.last_seen_at) {
          const d = new Date(u.last_seen_at);
          const dateStr = d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' });
          const timeStr = d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
          lastActivityHtml = `
            <div style="font-weight: 700; font-family: monospace; font-size: 11.5px; color: #334155;">${dateStr}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">${timeStr}</div>
          `;
        } else {
          lastActivityHtml = `<span style="background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 10.5px; display: inline-block; white-space: nowrap;">لم يسجل أي دخول قط</span>`;
        }

        const tripleName = getSmartTripleName(u.full_name);
        const displayWorkplace = u.workplace || formatWorkplaceHierarchy(u.dept_text, u.section_text, u.unit_text, govNameAr);

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
            <td style="padding: 7px 4px; text-align: center; color: #64748b; font-weight: bold; font-size: 11.5px;">${idx + 1}</td>
            <td style="padding: 7px 6px; font-weight: 700; color: #1e293b; white-space: nowrap;">${tripleName}</td>
            <td style="padding: 7px 6px; color: #1e293b; font-weight: 600; white-space: nowrap;">${displayWorkplace}</td>
            <td style="padding: 6px 4px; text-align: center; white-space: nowrap;">
              ${lastActivityHtml}
            </td>
          </tr>
        `;
      }
    }).join('');

    const statsPillsHtml = isAct
      ? `
        <span class="badge">المجموع: ${totalVisitors} موظفاً</span>
        <span class="badge-pwa">📱 PWA: ${pwaCount}</span>
        <span class="badge-browser">🌐 متصفح: ${browserCount}</span>
      `
      : `
        <span class="badge" style="background: #fef3c7; color: #92400e;">غير المتفاعلين: ${inactiveCount} موظفاً</span>
        <span class="badge" style="background: #e0f2fe; color: #0369a1;">كادر المديرية: ${totalStaff}</span>
      `;

    // Notice: Balanced column widths ensuring zero overflow on A4 portrait
    const tableHeadersHtml = isAct
      ? `
        <tr>
          <th style="width: 32px;" class="center">ت</th>
          <th style="width: 140px;">اسم الموظف</th>
          <th>مكان العمل</th>
          <th style="width: 90px;" class="center">آخر تصفح</th>
          <th style="width: 95px;" class="center">وسيلة الدخول</th>
        </tr>
      `
      : `
        <tr>
          <th style="width: 32px;" class="center">ت</th>
          <th style="width: 140px;">اسم الموظف</th>
          <th>مكان العمل</th>
          <th style="width: 115px;" class="center">آخر نشاط</th>
        </tr>
      `;

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${reportTitle} - ${startDate} إلى ${endDate}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 10mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            background: #fff;
            color: #0f172a;
            margin: 0;
            padding: 0;
            direction: rtl;
            width: 100%;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid ${isAct ? '#0284c7' : '#d97706'};
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .header-text {
            text-align: right;
          }
          .header-text h2 {
            margin: 0 0 3px 0;
            font-size: 15px;
            color: #0f172a;
          }
          .header-text h3 {
            margin: 0;
            font-size: 12.5px;
            color: ${isAct ? '#0284c7' : '#d97706'};
          }
          .doc-info {
            text-align: left;
            font-size: 10.5px;
            color: #64748b;
          }
          .title-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 12px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .title-box h1 {
            margin: 0;
            font-size: 13.5px;
            color: #1e293b;
          }
          .stats-pills {
            display: flex;
            gap: 6px;
            align-items: center;
          }
          .badge {
            background: #e0f2fe;
            color: #0369a1;
            padding: 3px 8px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 11px;
          }
          .badge-pwa {
            background: #dcfce7;
            color: #15803d;
            padding: 3px 8px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 10.5px;
          }
          .badge-browser {
            background: #f1f5f9;
            color: #475569;
            padding: 3px 8px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 10.5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          th {
            background: #0f172a;
            color: #fff;
            padding: 7px 5px;
            font-size: 11.5px;
            font-weight: 700;
            text-align: right;
            white-space: nowrap;
          }
          th.center {
            text-align: center;
          }
          td {
            border-bottom: 1px solid #e2e8f0;
          }
          .footer {
            margin-top: 15px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 6px;
            font-size: 10px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-text">
            <h2>جمهورية العراق - وزارة الاتصالات</h2>
            <h3>الشركة العامة للاتصالات والمعلوماتية - مديرية اتصالات ${govNameAr}</h3>
          </div>
          <div class="doc-info">
            <div>نظام الإدارة الموحد</div>
            <div>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-IQ')}</div>
            <div style="margin-top: 2px;">الترتيب: ${sortLabels[sortBy]}</div>
          </div>
        </div>

        <div class="title-box">
          <div>
            <h1>${reportTitle}</h1>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              الفترة المحددة: من <strong>${startDate}</strong> إلى <strong>${endDate}</strong>
            </div>
          </div>
          <div class="stats-pills">
            ${statsPillsHtml}
          </div>
        </div>

        <table>
          <thead>
            ${tableHeadersHtml}
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>تم التوليد آلياً عبر لوحة الإشراف المركزية</div>
          <div>صفحة 1 من 1</div>
        </div>

      </body>
      </html>
    `;

    const printIframe = document.createElement('iframe');
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = '0';
    document.body.appendChild(printIframe);

    const iframeDoc = printIframe.contentWindow?.document;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    printIframe.contentWindow?.addEventListener('afterprint', () => {
      printIframe.remove();
    });

    printIframe.contentWindow?.focus();
    printIframe.contentWindow?.print();
  };

  const handleExportExcel = () => {
    const isAct = activeTab === 'active';
    const filename = isAct 
      ? `سجل_المتصفحين_${startDate}_إلى_${endDate}.csv`
      : `سجل_الموظفين_غير_المتفاعلين_${startDate}_إلى_${endDate}.csv`;

    // UTF-8 BOM (﻿) ensures Excel and WPS open Arabic text flawlessly without encoding glitches
    let csvContent = '\uFEFF';
    
    if (isAct) {
      csvContent += 'ت,اسم الموظف,مكان العمل,تاريخ آخر تصفح,وقت آخر تصفح,وسيلة الدخول\n';
      sortedList.forEach((item, idx) => {
        const v = item as VisitorRecord;
        const tripleName = getSmartTripleName(v.full_name);
        const displayWorkplace = v.workplace || formatWorkplaceHierarchy(v.dept_text, v.section_text, v.unit_text, govNameAr);
        const d = new Date(v.last_login_at);
        const dateStr = d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
        const channel = v.is_pwa ? 'تطبيق PWA' : 'متصفح ويب';
        csvContent += `${idx + 1},"${tripleName.replace(/"/g, '""')}","${displayWorkplace.replace(/"/g, '""')}","${dateStr}","${timeStr}","${channel}"\n`;
      });
    } else {
      csvContent += 'ت,اسم الموظف,مكان العمل,حالة التفاعل,آخر نشاط مسجل للنظام\n';
      sortedList.forEach((item, idx) => {
        const u = item as InactiveRecord;
        const tripleName = getSmartTripleName(u.full_name);
        const displayWorkplace = u.workplace || formatWorkplaceHierarchy(u.dept_text, u.section_text, u.unit_text, govNameAr);
        let lastActivity = 'لم يسجل أي دخول قط';
        if (u.last_seen_at) {
          const d = new Date(u.last_seen_at);
          lastActivity = `${d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' })} ${d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}`;
        }
        csvContent += `${idx + 1},"${tripleName.replace(/"/g, '""')}","${displayWorkplace.replace(/"/g, '""')}","غير متفاعل","${lastActivity.replace(/"/g, '""')}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col",
            theme === 'light' 
              ? "bg-white/95 border-gray-200 text-gray-900" 
              : "bg-gray-900/95 border-white/10 text-white"
          )}
        >
          {/* Header - Compact to eliminate wasted vertical space */}
          <div className={cn(
            "flex items-center justify-between px-5 py-3 border-b",
            theme === 'light' ? "border-gray-100 bg-gray-50/50" : "border-white/5 bg-white/[0.02]"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base leading-tight">سجل المتصفحين والنشاط الفعلي للنظام</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  مديرية اتصالات {govNameAr}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                theme === 'light' 
                  ? "hover:bg-gray-200 text-gray-500" 
                  : "hover:bg-white/10 text-gray-400"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body - Streamlined layout */}
          <div className="p-4 space-y-3">
            {/* Filter Section (Date Range) */}
            <div className={cn(
              "p-3 rounded-xl border space-y-1.5",
              theme === 'light' ? "bg-gray-50 border-gray-200/80" : "bg-white/[0.03] border-white/5"
            )}>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-green-500" />
                  اختر الفترة من إلى
                </span>
                {startDate === endDate && (
                  <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full font-normal">
                    عرض يوم واحد ({startDate})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">من تاريخ</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    className={cn(
                      "w-full px-2.5 py-1.5 rounded-lg text-xs border font-mono transition-all outline-none",
                      theme === 'light'
                        ? "bg-white border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        : "bg-gray-800 border-gray-700 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">إلى تاريخ</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={handleEndDateChange}
                    className={cn(
                      "w-full px-2.5 py-1.5 rounded-lg text-xs border font-mono transition-all outline-none",
                      theme === 'light'
                        ? "bg-white border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        : "bg-gray-800 border-gray-700 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Sub-Tabs (غير المتفاعلين / المتفاعلون) + Filter/Sort Dropdown */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              {/* Segmented Tabs (Areas 2 & 3) */}
              <div className={cn(
                "inline-flex p-1 rounded-xl border gap-1",
                theme === 'light' ? "bg-gray-100/90 border-gray-200" : "bg-white/[0.04] border-white/10"
              )}>
                {/* 2: غير المتفاعلين */}
                <button
                  type="button"
                  onClick={() => setActiveTab('inactive')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeTab === 'inactive'
                      ? "bg-amber-600 text-white shadow-sm"
                      : theme === 'light' 
                        ? "text-gray-600 hover:text-gray-900 hover:bg-white/60" 
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>غير المتفاعلين</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                    activeTab === 'inactive' 
                      ? "bg-white/20 text-white" 
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  )}>
                    {inactiveCount}
                  </span>
                </button>

                {/* 3: المتفاعلون */}
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeTab === 'active'
                      ? "bg-green-600 text-white shadow-sm"
                      : theme === 'light' 
                        ? "text-gray-600 hover:text-gray-900 hover:bg-white/60" 
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>المتفاعلون</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                    activeTab === 'active' 
                      ? "bg-white/20 text-white" 
                      : "bg-green-500/10 text-green-700 dark:text-green-300"
                  )}>
                    {totalVisitors}
                  </span>
                </button>
              </div>

              {/* 4: Sort & Filter Dropdown */}
              <div className="relative" ref={sortMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowSortMenu(prev => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm",
                    theme === 'light'
                      ? "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
                      : "bg-gray-800 hover:bg-gray-750 border-gray-700 text-gray-200"
                  )}
                >
                  <Filter className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>الفرز: {sortLabels[sortBy]}</span>
                  <ChevronDown className={cn("w-3 h-3 text-gray-400 transition-transform duration-200", showSortMenu && "rotate-180")} />
                </button>

                {showSortMenu && (
                  <div className={cn(
                    "absolute left-0 top-full mt-1.5 w-48 rounded-xl border shadow-xl z-30 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150",
                    theme === 'light' ? "bg-white border-gray-200" : "bg-gray-800 border-gray-700 text-white"
                  )}>
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-400 border-b border-gray-100 dark:border-gray-700/60 mb-0.5">
                      ترتيب وعرض القائمة
                    </div>
                    {(['date', 'alpha', 'workplace'] as SortOption[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setSortBy(opt);
                          setShowSortMenu(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-right text-xs flex items-center justify-between transition-colors",
                          sortBy === opt
                            ? theme === 'light' ? "bg-green-50 text-green-700 font-bold" : "bg-green-500/10 text-green-400 font-bold"
                            : theme === 'light' ? "hover:bg-gray-50 text-gray-700" : "hover:bg-white/5 text-gray-300"
                        )}
                      >
                        <span>{sortLabels[opt]}</span>
                        {sortBy === opt && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Results Header with Counts, Badges & Print Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 pt-1">
              {activeTab === 'active' ? (
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs text-gray-400">إجمالي المتفاعلين:</span>
                  <span className="text-base font-black text-green-500">
                    {loading ? '...' : `${totalVisitors} موظفاً`}
                  </span>
                  {!loading && totalVisitors > 0 && (
                    <div className="flex items-center gap-1.5 mr-2">
                      <span className="text-[10px] font-bold text-green-600 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                        📱 PWA: {pwaCount}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
                        🌐 متصفح: {browserCount}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs text-gray-400">إجمالي غير المتفاعلين:</span>
                  <span className="text-base font-black text-amber-500">
                    {loading ? '...' : `${inactiveCount} موظفاً`}
                  </span>
                  {!loading && inactiveCount > 0 && (
                    <div className="flex items-center gap-1.5 mr-2">
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                        كادر المديرية: {totalStaff}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
                        🕒 مسجلون سابقاً: {inactiveUsers.filter(u => u.last_seen_at).length}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {sortedList.length > 0 && !loading && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all shadow-sm"
                    title="تصدير جدول البيانات إلى Excel مباشرة"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    تصدير Excel
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border border-green-500/30 transition-all shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    طباعة القائمة PDF
                  </button>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* List Container (Extended height, smooth scroll) */}
            <div className={cn(
              "rounded-xl border overflow-hidden",
              theme === 'light' ? "border-gray-200 bg-gray-50/30" : "border-white/5 bg-black/20"
            )}>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                  <span className="text-xs">جاري جلب البيانات...</span>
                </div>
              ) : sortedList.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  {activeTab === 'active' 
                    ? 'لا يوجد متصفحين مسجلين في هذه الفترة المحددة.'
                    : 'لا يوجد موظفين غير متفاعلين (الجميع تفاعلوا في هذه الفترة).'}
                </div>
              ) : (
                <div className="max-h-[260px] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
                  {sortedList.map((item) => {
                    const smartName = getSmartTripleName(item.full_name);
                    const formattedWp = item.workplace || formatWorkplaceHierarchy(item.dept_text, item.section_text, item.unit_text, govNameAr);

                    if (activeTab === 'active') {
                      const visitor = item as VisitorRecord;
                      return (
                        <div
                          key={visitor.user_id}
                          className={cn(
                            "px-4 py-2 flex items-center justify-between text-xs transition-colors",
                            theme === 'light' ? "hover:bg-gray-100/60" : "hover:bg-white/[0.04]"
                          )}
                        >
                          {/* Name (Triple Smart) + PWA/Browser Badge */}
                          <div className="flex items-center gap-2 max-w-[50%]">
                            <span 
                              title={visitor.full_name}
                              className="font-bold text-gray-900 dark:text-white truncate"
                            >
                              {smartName}
                            </span>
                            {visitor.is_pwa ? (
                              <span 
                                title="دخول من تطبيق PWA مثبت"
                                className="text-[9px] font-bold text-green-600 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1"
                              >
                                <Smartphone className="w-2.5 h-2.5" />
                                PWA
                              </span>
                            ) : (
                              <span 
                                title="دخول من متصفح ويب عبر الرابط"
                                className="text-[9px] font-bold text-gray-500 bg-gray-500/10 border border-gray-500/20 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1"
                              >
                                <Globe className="w-2.5 h-2.5" />
                                متصفح
                              </span>
                            )}
                          </div>

                          {/* Workplace */}
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px] truncate max-w-[48%] justify-end">
                            <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0 opacity-70" />
                            <span className="truncate" title={formattedWp}>{formattedWp}</span>
                          </div>
                        </div>
                      );
                    } else {
                      const user = item as InactiveRecord;
                      return (
                        <div
                          key={user.user_id}
                          className={cn(
                            "px-4 py-2 flex items-center justify-between text-xs transition-colors",
                            theme === 'light' ? "hover:bg-gray-100/60" : "hover:bg-white/[0.04]"
                          )}
                        >
                          {/* Name (Triple Smart) + Last Seen Badge */}
                          <div className="flex items-center gap-2 max-w-[55%]">
                            <span 
                              title={user.full_name}
                              className="font-bold text-gray-900 dark:text-white truncate"
                            >
                              {smartName}
                            </span>
                            {user.last_seen_at ? (
                              <span 
                                title={`آخر نشاط مسجل: ${formatDateAr(user.last_seen_at)}`}
                                className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1"
                              >
                                <Clock className="w-2.5 h-2.5" />
                                آخر ظهور: {formatDateShort(user.last_seen_at)}
                              </span>
                            ) : (
                              <span 
                                title="الموظف لم يقم بالدخول إلى النظام إطلاقاً"
                                className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1"
                              >
                                <AlertCircle className="w-2.5 h-2.5" />
                                لم يسجل دخول قط
                              </span>
                            )}
                          </div>

                          {/* Workplace */}
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px] truncate max-w-[43%] justify-end">
                            <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-70" />
                            <span className="truncate" title={formattedWp}>{formattedWp}</span>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={cn(
            "px-5 py-2.5 border-t flex justify-between items-center text-xs text-gray-400",
            theme === 'light' ? "border-gray-100 bg-gray-50" : "border-white/5 bg-white/[0.01]"
          )}>
            <span>يتم التحديث فورياً عند تغيير الفترة أو التبويب</span>
            <button
              onClick={onClose}
              className={cn(
                "px-4 py-1.5 rounded-lg font-medium transition-colors",
                theme === 'light'
                  ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  : "bg-white/10 hover:bg-white/20 text-white"
              )}
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
