/**
 * ============================================================
 * مساحة عمل المحاكي — التجميع النهائي (رأس + أدوات + لوحة + فحص)
 * ============================================================
 * تُحمَّل كسولاً (React.lazy) من بطاقة الإطلاق كي تبقى خارج
 * حزمة التطبيق الأساسي حتى يفتحها المطور.
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { simRedo, simUndo, useSimulatorStore } from './store/simulator.store';
import { getMapById } from './data/maps/registry';
import SimCanvas from './ui/SimCanvas';
import SimToolbar from './ui/SimToolbar';
import SimInspector from './ui/SimInspector';
import SplicingLab from './ui/SplicingLab';
import TestingPanel from './ui/TestingPanel';
import type { PhaseId } from './types';

const PHASES: { id: PhaseId; nameAr: string; descAr: string }[] = [
  { id: 'civil', nameAr: 'الأعمال المدنية', descAr: 'مسارات الحفر والأنابيب والمنشآت' },
  { id: 'optical', nameAr: 'الشبكة البصرية', descAr: 'الكبينة والقواسم وكابلات الإسقاط' },
  { id: 'splicing', nameAr: 'مختبر اللحام', descAr: 'محاكاة اللحام والتسلسل اللوني' },
  { id: 'testing', nameAr: 'الاختبار والتشغيل', descAr: 'OTDR ومقياس القدرة والتقييم' },
];

export default function FiberSimulatorWorkspace({
  onClose,
}: {
  onClose: () => void;
}): React.ReactElement {
  const st = useSimulatorStore();
  const map = getMapById(st.mapId);

  /* اختصارات لوحة المفاتيح */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;

      if (e.key === 'Escape') {
        if (st.trenchDraft) st.cancelTrench();
        if (st.dropDraft) st.cancelDrop();
        st.setMeasure(null, null);
        return;
      }
      if (e.key === 'Enter' && st.trenchDraft) {
        e.preventDefault();
        st.commitTrench();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) simRedo();
        else simUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        simRedo();
        return;
      }
      if (e.key === 'Backspace' && st.trenchDraft) {
        e.preventDefault();
        st.undoTrenchPoint();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedIds.length === 1) {
        e.preventDefault();
        const id = st.selectedIds[0];
        const e2 = st.entities;
        const kind = e2.trenches.some((x) => x.id === id)
          ? 'trench'
          : e2.structures.some((x) => x.id === id)
            ? 'structure'
            : e2.cabinets.some((x) => x.id === id)
              ? 'cabinet'
              : e2.fats.some((x) => x.id === id)
                ? 'fat'
                : e2.drops.some((x) => x.id === id)
                  ? 'drop'
                  : null;
        if (kind) st.removeEntity(kind, id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st]);

  return (
    <div dir="rtl" className="fixed inset-0 z-[90] flex flex-col bg-[#070d18] text-slate-200">
      {/* الرأس */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-3">
        <button
          type="button"
          onClick={onClose}
          title="إغلاق المحاكي والعودة"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <X size={20} />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold text-slate-100">
            محاكي بناء شبكات الألياف الضوئية FTTH
          </h1>
          <p className="truncate text-[11px] text-slate-500">
            {map ? `${map.name} — ${map.requirements.homes} داراً` : ''}
          </p>
        </div>

        {/* متدرج الأطوار */}
        <nav className="mr-auto flex items-center gap-1">
          {PHASES.map((p, i) => {
            const active = st.phase === p.id;
            const done = PHASES.findIndex((x) => x.id === st.phase) > i;
            return (
              <button
                key={p.id}
                type="button"
                title={p.descAr}
                onClick={() => st.setPhase(p.id)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'bg-indigo-500/25 text-indigo-200 ring-1 ring-indigo-400/50'
                    : done
                      ? 'text-emerald-400/80 hover:bg-slate-800'
                      : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {i + 1}. {p.nameAr}
              </button>
            );
          })}
        </nav>

        <span className="rounded-full border border-amber-800/60 bg-amber-950/40 px-2.5 py-1 text-[10px] text-amber-300">
          نسخة التطوير
        </span>
      </header>

      {/* الجسم — يتغير حسب الطور */}
      <div className="flex min-h-0 flex-1">
        {st.phase === 'splicing' ? (
          <div className="min-h-0 flex-1">
            <SplicingLab />
          </div>
        ) : st.phase === 'testing' ? (
          <div className="min-h-0 flex-1">
            <TestingPanel />
          </div>
        ) : (
          <>
            <SimToolbar />
            <main className="min-w-0 flex-1">
              <SimCanvas />
            </main>
            <SimInspector />
          </>
        )}
      </div>
    </div>
  );
}
