import fs from 'fs';

const filePath = 'd:/InfTeleKarbala/src/components/admin/dashboard/ActiveVisitorsModal.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Add FileSpreadsheet to lucide-react imports
if (!code.includes('FileSpreadsheet')) {
    code = code.replace("  Printer,", "  Printer,\n  FileSpreadsheet,");
    console.log('Added FileSpreadsheet import');
}

// 2. Add handleExportExcel after handlePrint
const oldPrintEnd = `    printIframe.contentWindow?.focus();
    printIframe.contentWindow?.print();
  };`;

const newExportFunc = `    printIframe.contentWindow?.focus();
    printIframe.contentWindow?.print();
  };

  const handleExportExcel = () => {
    const isAct = activeTab === 'active';
    const filename = isAct 
      ? \`سجل_المتصفحين_\${startDate}_إلى_\${endDate}.csv\`
      : \`سجل_الموظفين_غير_المتفاعلين_\${startDate}_إلى_\${endDate}.csv\`;

    // UTF-8 BOM (\uFEFF) ensures Excel and WPS open Arabic text flawlessly without encoding glitches
    let csvContent = '\\uFEFF';
    
    if (isAct) {
      csvContent += 'ت,اسم الموظف,مكان العمل,تاريخ آخر تصفح,وقت آخر تصفح,وسيلة الدخول\\n';
      sortedList.forEach((item, idx) => {
        const v = item as VisitorRecord;
        const tripleName = getSmartTripleName(v.full_name);
        const displayWorkplace = v.workplace || formatWorkplaceHierarchy(v.dept_text, v.section_text, v.unit_text, govNameAr);
        const d = new Date(v.last_login_at);
        const dateStr = d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
        const channel = v.is_pwa ? 'تطبيق PWA' : 'متصفح ويب';
        csvContent += \`\${idx + 1},"\${tripleName.replace(/"/g, '""')}","\${displayWorkplace.replace(/"/g, '""')}","\${dateStr}","\${timeStr}","\${channel}"\\n\`;
      });
    } else {
      csvContent += 'ت,اسم الموظف,مكان العمل,حالة التفاعل,آخر نشاط مسجل للنظام\\n';
      sortedList.forEach((item, idx) => {
        const u = item as InactiveRecord;
        const tripleName = getSmartTripleName(u.full_name);
        const displayWorkplace = u.workplace || formatWorkplaceHierarchy(u.dept_text, u.section_text, u.unit_text, govNameAr);
        let lastActivity = 'لم يسجل أي دخول قط';
        if (u.last_seen_at) {
          const d = new Date(u.last_seen_at);
          lastActivity = \`\${d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' })} \${d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}\`;
        }
        csvContent += \`\${idx + 1},"\${tripleName.replace(/"/g, '""')}","\${displayWorkplace.replace(/"/g, '""')}","غير متفاعل","\${lastActivity.replace(/"/g, '""')}"\\n\`;
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
  };`;

// 3. Update the button section
const oldButtonSnippet = `              {sortedList.length > 0 && !loading && (
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border border-green-500/30 transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة القائمة PDF
                </button>
              )}`;

const newButtonSnippet = `              {sortedList.length > 0 && !loading && (
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
              )}`;

const codeLf = code.replace(/\r\n/g, '\n');
const oldPrintEndLf = oldPrintEnd.replace(/\r\n/g, '\n');
const newExportFuncLf = newExportFunc.replace(/\r\n/g, '\n');
const oldButtonSnippetLf = oldButtonSnippet.replace(/\r\n/g, '\n');
const newButtonSnippetLf = newButtonSnippet.replace(/\r\n/g, '\n');

if (codeLf.includes(oldPrintEndLf) && codeLf.includes(oldButtonSnippetLf)) {
    code = codeLf.replace(oldPrintEndLf, newExportFuncLf).replace(oldButtonSnippetLf, newButtonSnippetLf);
    fs.writeFileSync(filePath, code, 'utf-8');
    console.log('Successfully patched ActiveVisitorsModal.tsx');
} else {
    console.error('Could not find snippets in ActiveVisitorsModal.tsx');
    process.exit(1);
}
