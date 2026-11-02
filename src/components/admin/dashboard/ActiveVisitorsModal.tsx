import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Calendar, 
  Users, 
  Printer, 
  Loader2, 
  Building2, 
  AlertCircle,
  Smartphone,
  Globe
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';

interface VisitorRecord {
  user_id: string;
  full_name: string;
  workplace: string;
  last_login_at: string;
  visit_count: number;
  is_pwa?: boolean;
}

interface ActiveVisitorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  governorate: string;
}

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
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [totalVisitors, setTotalVisitors] = useState<number>(0);
  const [pwaCount, setPwaCount] = useState<number>(0);
  const [browserCount, setBrowserCount] = useState<number>(0);

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
      setTotalVisitors(data?.total_visitors || 0);
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

  const handlePrint = () => {
    const sorted = [...visitors].sort(
      (a, b) => new Date(b.last_login_at).getTime() - new Date(a.last_login_at).getTime()
    );

    const rowsHtml = sorted.map((v, idx) => {
      const d = new Date(v.last_login_at);
      const dateStr = d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' });
      const timeStr = d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      const channelBadge = v.is_pwa 
        ? `<span style="background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 11px; display: inline-block;">📱 تطبيق PWA</span>`
        : `<span style="background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 11px; display: inline-block;">🌐 متصفح ويب</span>`;

      return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 10px 8px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
        <td style="padding: 10px 8px; font-weight: 700; color: #1e293b;">${v.full_name}</td>
        <td style="padding: 10px 8px; color: #334155;">${v.workplace || 'مديرية الاتصالات'}</td>
        <td style="padding: 8px 8px; text-align: center; color: #0f172a;">
          <div style="font-weight: 700; font-family: monospace; font-size: 13px;">${dateStr}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${timeStr}</div>
        </td>
        <td style="padding: 10px 8px; text-align: center;">
          ${channelBadge}
        </td>
      </tr>
    `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>قائمة المتصفحين - ${startDate} إلى ${endDate}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            background: #fff;
            color: #0f172a;
            margin: 0;
            padding: 10px;
            direction: rtl;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .header-text {
            text-align: right;
          }
          .header-text h2 {
            margin: 0 0 4px 0;
            font-size: 16px;
            color: #0f172a;
          }
          .header-text h3 {
            margin: 0;
            font-size: 14px;
            color: #0284c7;
          }
          .doc-info {
            text-align: left;
            font-size: 12px;
            color: #64748b;
          }
          .title-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .title-box h1 {
            margin: 0;
            font-size: 15px;
            color: #1e293b;
          }
          .stats-pills {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          .badge {
            background: #e0f2fe;
            color: #0369a1;
            padding: 5px 12px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 13px;
          }
          .badge-pwa {
            background: #dcfce7;
            color: #15803d;
            padding: 5px 10px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 12px;
          }
          .badge-browser {
            background: #f1f5f9;
            color: #475569;
            padding: 5px 10px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background: #0f172a;
            color: #fff;
            padding: 9px 8px;
            font-size: 13px;
            font-weight: 700;
            text-align: right;
          }
          th.center {
            text-align: center;
          }
          .footer {
            margin-top: 30px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 10px;
            font-size: 11px;
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
          </div>
        </div>

        <div class="title-box">
          <div>
            <h1>سجل المتصفحين والولوج الفعلي للتطبيق</h1>
            <div style="font-size: 12px; color: #64748b; margin-top: 3px;">
              الفترة من: <strong>${startDate}</strong> إلى: <strong>${endDate}</strong>
            </div>
          </div>
          <div class="stats-pills">
            <span class="badge">المجموع: ${totalVisitors}</span>
            <span class="badge-pwa">📱 PWA: ${pwaCount}</span>
            <span class="badge-browser">🌐 متصفح: ${browserCount}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 45px;" class="center">ت</th>
              <th>اسم الموظف</th>
              <th>مكان العمل</th>
              <th style="width: 140px;" class="center">آخر تصفح (التاريخ والوقت)</th>
              <th style="width: 130px;" class="center">وسيلة الدخول</th>
            </tr>
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
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between px-5 py-4 border-b",
            theme === 'light' ? "border-gray-100 bg-gray-50/50" : "border-white/5 bg-white/[0.02]"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base leading-tight">سجل المتصفحين الفعلي للنظام</h3>
                <p className="text-xs text-gray-400 mt-0.5">
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

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Filter Section */}
            <div className={cn(
              "p-4 rounded-xl border space-y-2",
              theme === 'light' ? "bg-gray-50 border-gray-200/80" : "bg-white/[0.03] border-white/5"
            )}>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-green-500" />
                  اختر الفترة من إلى
                </span>
                {startDate === endDate && (
                  <span className="text-[11px] text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full font-normal">
                    عرض يوم واحد ({startDate})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">من تاريخ</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-sm border font-mono transition-all outline-none",
                      theme === 'light'
                        ? "bg-white border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        : "bg-gray-800 border-gray-700 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={handleEndDateChange}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-sm border font-mono transition-all outline-none",
                      theme === 'light'
                        ? "bg-white border-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        : "bg-gray-800 border-gray-700 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Results Header with Counts & Channel Badges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs text-gray-400">إجمالي المتصفحين:</span>
                <span className="text-lg font-black text-green-500">
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
              {visitors.length > 0 && !loading && (
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border border-green-500/30 transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة القائمة PDF
                </button>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Visitors Container (max 4 visible without scroll) */}
            <div className={cn(
              "rounded-xl border overflow-hidden",
              theme === 'light' ? "border-gray-200 bg-gray-50/30" : "border-white/5 bg-black/20"
            )}>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                  <span className="text-xs">جاري جلب سجل المتصفحين...</span>
                </div>
              ) : visitors.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  لا يوجد متصفحين مسجلين في هذه الفترة المحددة.
                </div>
              ) : (
                <div className="max-h-[190px] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
                  {[...visitors]
                    .sort((a, b) => new Date(b.last_login_at).getTime() - new Date(a.last_login_at).getTime())
                    .map((visitor) => (
                    <div
                      key={visitor.user_id}
                      className={cn(
                        "px-4 py-2.5 flex items-center justify-between text-xs transition-colors",
                        theme === 'light' ? "hover:bg-gray-100/60" : "hover:bg-white/[0.04]"
                      )}
                    >
                      {/* اسم الموظف مع شارة وسيلة الدخول */}
                      <div className="flex items-center gap-2 max-w-[50%]">
                        <span className="font-bold text-gray-900 dark:text-white truncate">
                          {visitor.full_name}
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

                      {/* مكان عمله في نفس السطر */}
                      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px] truncate max-w-[48%] justify-end">
                        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0 opacity-70" />
                        <span className="truncate">{visitor.workplace}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={cn(
            "px-5 py-3 border-t flex justify-between items-center text-xs text-gray-400",
            theme === 'light' ? "border-gray-100 bg-gray-50" : "border-white/5 bg-white/[0.01]"
          )}>
            <span>يتم التحديث فورياً عند اختيار التاريخ</span>
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
