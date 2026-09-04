/**
 * ============================================================
 * تصدير نتائج المحاكي — Excel (ExcelJS) + PDF (jsPDF+html2canvas)
 * ============================================================
 * تقرير المشروع الكامل: ملخص تنفيذي + جدول الكميات والتكاليف.
 * التصدير بجهة RTL ليعرض العربية كما في التطبيق.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { SimMap } from '../types';
import type { BoqReport } from '../engine/boq';
import type { DesignReport } from '../engine/rules';
import type { ScoreResult } from '../engine/scoring';
import { USD_TO_IQD } from '../data/materials.catalog';

export interface ExportMeta {
  userName: string;
  map: SimMap;
  report: DesignReport;
  boq: BoqReport;
  score: ScoreResult | null;
}

const CATEGORY_AR: Record<string, string> = {
  cable: 'كابلات الألياف الضوئية',
  duct: 'الأنابيب',
  civil: 'الأعمال المدنية',
  structure: 'المنشآت والصناديق',
  passive: 'العناصر البصرية السلبية',
  termination: 'الإنهاءات واللحام',
  equipment: 'المعدات النشطة',
};

const UNIT_AR: Record<string, string> = {
  m: 'متر',
  pc: 'قطعة',
  set: 'طقم',
  splice: 'لحامة',
  port: 'منفذ',
};

const fmtDate = (): string => new Date().toLocaleDateString('en-GB');

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

/* ================================================================
 * 1) تصدير Excel — ورقة RTL بأقسام ملونة وإجماليات
 * ================================================================ */

export async function exportProjectExcel(meta: ExportMeta): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'محاكي FTTH — الإدارة الموحدة';
  wb.created = new Date();

  const ws = wb.addWorksheet('جدول الكميات', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 6 }],
  });

  /* أعمدة: البند | الوحدة | الكمية | سعر الوحدة $ | الإجمالي $ */
  ws.columns = [
    { width: 52 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
  ];

  const title = ws.addRow(['محاكي بناء شبكات الألياف الضوئية FTTH — تقرير المشروع']);
  title.font = { bold: true, size: 15, color: { argb: 'FF1e293b' } };
  ws.mergeCells(`A${title.number}:E${title.number}`);
  title.alignment = { horizontal: 'center' };

  const sub = ws.addRow([
    `الخريطة: ${meta.map.name}  |  المصمم: ${meta.userName}  |  التاريخ: ${fmtDate()}`,
  ]);
  sub.font = { size: 11, color: { argb: 'FF475569' } };
  ws.mergeCells(`A${sub.number}:E${sub.number}`);
  sub.alignment = { horizontal: 'center' };

  /* الملخص التنفيذي */
  const summaryRows: [string, string][] = [
    ['التغطية', `${meta.report.coverage.covered}/${meta.report.coverage.total} داراً`],
    [
      'أسوأ إشارة',
      meta.report.worstRxDbm !== null ? `${meta.report.worstRxDbm.toFixed(1)} dBm` : '—',
    ],
    ['إجمالي الحفر', `${meta.boq.trenchMeters.toLocaleString('en-US')} م`],
    ['إجمالي الأنابيب', `${meta.boq.ductMeters.toLocaleString('en-US')} م.أنبوب`],
    ['الكلفة الإجمالية', `${meta.boq.grandTotalUSD.toLocaleString('en-US')} $ (${meta.boq.grandTotalIQD.toLocaleString('en-US')} د.ع)`],
    [
      'الكلفة لكل دار',
      meta.boq.costPerHomeUSD !== null ? `${meta.boq.costPerHomeUSD.toLocaleString('en-US')} $` : '—',
    ],
    [
      'التقييم',
      meta.score
        ? `${meta.score.stars}/5 نجوم (${meta.score.percentage}%) — ${meta.score.titleAr}`
        : 'لم يُقيَّم بعد',
    ],
  ];
  for (const [k, v] of summaryRows) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    ws.mergeCells(`B${r.number}:E${r.number}`);
  }
  ws.addRow([]);

  /* رأس الجدول */
  const head = ws.addRow(['البند', 'الوحدة', 'الكمية', 'سعر الوحدة ($)', 'الإجمالي ($)']);
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFf8fafc' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1d4ed8' } };
    c.alignment = { horizontal: 'center' };
    c.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  /* الصفوف مجمّعة حسب الفئة */
  let currentCat = '';
  for (const line of meta.boq.lines) {
    if (line.category !== currentCat) {
      currentCat = line.category;
      const catRow = ws.addRow([CATEGORY_AR[line.category] ?? line.category]);
      catRow.font = { bold: true, color: { argb: 'FF0f172a' } };
      catRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
      ws.mergeCells(`A${catRow.number}:E${catRow.number}`);
    }
    const r = ws.addRow([
      line.nameAr,
      UNIT_AR[line.unit] ?? line.unit,
      line.qty,
      line.unitUSD,
      line.totalUSD,
    ]);
    r.getCell(3).numFmt = '#,##0.0';
    r.getCell(4).numFmt = '#,##0.00';
    r.getCell(5).numFmt = '#,##0.00';
    r.alignment = { horizontal: 'center' };
    r.getCell(1).alignment = { horizontal: 'right' };
  }

  /* الإجمالي */
  const total = ws.addRow([
    'الإجمالي الكلي',
    '',
    '',
    '',
    meta.boq.grandTotalUSD,
  ]);
  total.font = { bold: true, size: 12 };
  total.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfef3c7' } };
    c.border = { top: { style: 'medium' } };
  });
  total.getCell(5).numFmt = '#,##0.00';
  ws.mergeCells(`A${total.number}:D${total.number}`);

  const iqd = ws.addRow([`ما يعادل بالدينار العراقي (سعر ${USD_TO_IQD}): ${meta.boq.grandTotalIQD.toLocaleString('en-US')} د.ع`]);
  iqd.font = { bold: true };
  ws.mergeCells(`A${iqd.number}:E${iqd.number}`);
  iqd.alignment = { horizontal: 'center' };

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `FTTH-BOQ-${meta.map.id}-${Date.now()}.xlsx`
  );
}

/* ================================================================
 * 2) تصدير PDF — رسم HTML عربي RTL ثم تقطيعه على صفحات A4
 * ================================================================ */

export async function exportProjectPdf(meta: ExportMeta): Promise<void> {
  /* بناء حاوية مخفية بنفس أسلوب التطبيق */
  const el = document.createElement('div');
  el.dir = 'rtl';
  el.style.cssText = `position:fixed;top:-20000px;right:0;width:794px;background:#ffffff;color:#0f172a;padding:36px;font-family:'Tajawal','Cairo','Segoe UI',Tahoma,sans-serif;`;

  const scoreBlock =
    meta.score === null
      ? ''
      : `<div style="margin-top:18px;border:2px solid #1d4ed8;border-radius:12px;padding:14px 18px;">
          <div style="font-size:18px;font-weight:bold;color:#1d4ed8;">التقييم النهائي: ${'★'.repeat(Math.floor(meta.score.stars))}${'☆'.repeat(5 - Math.ceil(meta.score.stars))} (${meta.score.stars}/5)</div>
          <div style="font-size:13px;margin-top:4px;">${meta.score.titleAr} — ${meta.score.percentage}%</div>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;">
            ${meta.score.criteria
              .map(
                (c) => `<tr>
                  <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${c.labelAr}</td>
                  <td style="border:1px solid #cbd5e1;padding:6px;">${c.detailAr}</td>
                  <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${Math.round(c.points)}/${c.weight}</td>
                </tr>`
              )
              .join('')}
          </table>
        </div>`;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0f172a;padding-bottom:12px;">
      <div>
        <div style="font-size:20px;font-weight:bold;">مديرية اتصالات ومعلوماتية كربلاء المقدسة</div>
        <div style="font-size:14px;font-weight:bold;color:#334155;">محاكي بناء شبكات الألياف الضوئية FTTH</div>
      </div>
      <div style="font-size:12px;color:#475569;text-align:left;">تاريخ التصدير<br/>${fmtDate()}</div>
    </div>

    <div style="text-align:center;margin:16px 0;">
      <div style="font-size:22px;font-weight:bold;">تقرير مشروع الشبكة — ${meta.map.name}</div>
      <div style="font-size:14px;color:#334155;">المصمم: ${meta.userName}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr>
        <td style="border:1px solid #cbd5e1;padding:7px;background:#eff6ff;font-weight:bold;width:22%;">التغطية</td>
        <td style="border:1px solid #cbd5e1;padding:7px;">${meta.report.coverage.covered}/${meta.report.coverage.total} داراً</td>
        <td style="border:1px solid #cbd5e1;padding:7px;background:#eff6ff;font-weight:bold;">أسوأ إشارة</td>
        <td style="border:1px solid #cbd5e1;padding:7px;">${meta.report.worstRxDbm !== null ? `${meta.report.worstRxDbm.toFixed(1)} dBm` : '—'}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:7px;background:#eff6ff;font-weight:bold;">إجمالي الحفر</td>
        <td style="border:1px solid #cbd5e1;padding:7px;">${meta.boq.trenchMeters.toLocaleString('en-US')} م</td>
        <td style="border:1px solid #cbd5e1;padding:7px;background:#eff6ff;font-weight:bold;">الكلفة لكل دار</td>
        <td style="border:1px solid #cbd5e1;padding:7px;">${meta.boq.costPerHomeUSD !== null ? `${meta.boq.costPerHomeUSD.toLocaleString('en-US')} $` : '—'}</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:7px;background:#eff6ff;font-weight:bold;">الكلفة الإجمالية</td>
        <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;">${meta.boq.grandTotalUSD.toLocaleString('en-US')} $ — ${meta.boq.grandTotalIQD.toLocaleString('en-US')} د.ع</td>
        <td style="border:1px solid #cbd5e1;padding:7px;background:#eff6ff;font-weight:bold;">الفحص البصري</td>
        <td style="border:1px solid #cbd5e1;padding:7px;">${meta.report.opticalOk ? 'ناجح ✔' : 'غير مكتمل ✘'}</td>
      </tr>
    </table>
    ${scoreBlock}

    <div style="font-size:16px;font-weight:bold;margin:18px 0 8px;">جدول الكميات والتكاليف (BOQ)</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#1d4ed8;color:#f8fafc;">
          <th style="border:1px solid #94a3b8;padding:6px;">البند</th>
          <th style="border:1px solid #94a3b8;padding:6px;">الوحدة</th>
          <th style="border:1px solid #94a3b8;padding:6px;">الكمية</th>
          <th style="border:1px solid #94a3b8;padding:6px;">سعر الوحدة $</th>
          <th style="border:1px solid #94a3b8;padding:6px;">الإجمالي $</th>
        </tr>
      </thead>
      <tbody>
        ${meta.boq.lines
          .map(
            (l, i) => `<tr style="background:${i % 2 ? '#f8fafc' : '#ffffff'};">
              <td style="border:1px solid #cbd5e1;padding:5px;">${l.nameAr}</td>
              <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${UNIT_AR[l.unit] ?? l.unit}</td>
              <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${l.qty.toLocaleString('en-US')}</td>
              <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${l.unitUSD.toLocaleString('en-US')}</td>
              <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-weight:bold;">${l.totalUSD.toLocaleString('en-US')}</td>
            </tr>`
          )
          .join('')}
        <tr style="background:#fef3c7;font-weight:bold;font-size:13px;">
          <td style="border:1px solid #94a3b8;padding:7px;" colspan="4">الإجمالي الكلي</td>
          <td style="border:1px solid #94a3b8;padding:7px;text-align:center;">${meta.boq.grandTotalUSD.toLocaleString('en-US')}</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:14px;font-size:10px;color:#64748b;text-align:center;">
      أسعار استرشادية لسوق 2026 (كتالوج محاكي FTTH) — تُحدَّث دورياً من مصادر موثوقة.
    </div>
  `;

  document.body.appendChild(el);
  try {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgW = pw - margin * 2;
    const pxPerMm = canvas.width / imgW;
    const pageHpx = (ph - margin * 2) * pxPerMm;
    let y = 0;
    let page = 0;
    while (y < canvas.height) {
      const sliceH = Math.min(pageHpx, canvas.height - y);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.ceil(sliceH);
      const ctx = slice.getContext('2d');
      if (ctx) ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, sliceH / pxPerMm);
      y += sliceH;
      page++;
    }
    pdf.save(`FTTH-Report-${meta.map.id}-${Date.now()}.pdf`);
  } finally {
    el.remove();
  }
}
