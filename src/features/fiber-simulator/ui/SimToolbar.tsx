/**
 * شريط أدوات المحاكي — أدوات الرسم والتحكم بالعرض
 */

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Cable,
  CircleDot,
  Eraser,
  Hand,
  Lightbulb,
  Maximize2,
  MousePointer2,
  Network,
  Redo2,
  Route,
  Ruler,
  Server,
  Square,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  simRedo,
  simUndo,
  useCanRedo,
  useCanUndo,
  useSimulatorStore,
} from '../store/simulator.store';
import { TRENCH_METHODS } from '../data/materials.catalog';
import type { ToolId, TrenchMethod } from '../types';

const TOOLS: { id: ToolId; label: string; icon: typeof MousePointer2; tourId?: string }[] = [
  { id: 'select', label: 'تحديد', icon: MousePointer2 },
  { id: 'pan', label: 'تحريك العرض', icon: Hand },
  { id: 'measure', label: 'قياس مسافة', icon: Ruler },
  { id: 'trench', label: 'رسم مسار حفر/أنابيب', icon: Route },
  { id: 'manhole', label: 'تركيب منهل خرساني', icon: CircleDot },
  { id: 'handhole', label: 'تركيب هاند هول', icon: Square },
  { id: 'fdc', label: 'تركيب كبينة FDC', icon: Server },
  { id: 'fat', label: 'تركيب صندوق FAT', icon: Network },
  { id: 'drop', label: 'كابل إسقاط نحو دار', icon: Cable },
  { id: 'eraser', label: 'ممحاة (حذف عنصر)', icon: Eraser },
  { id: 'hint', label: 'تلميح تعليمي — فعّله ثم انقر أي عنصر في المخطط لمعرفة وظيفته وترتيبه', icon: Lightbulb, tourId: 'hint-tool' },
];

function ToolButton({
  active,
  label,
  onClick,
  disabled,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState<{ right: number; top?: number; bottom?: number } | null>(null);

  /* التلميحة عبر portal بـ position:fixed كي لا يقصّها overflow-y-auto في الشريط.
     الهدف إلزامياً جذر المحاكي نفسه وليس document.body: المحاكي يدخل وضع
     ملء الشاشة على حاويته (Fullscreen API) وخارجها لا يُصيَّر أي عنصر —
     والـ fixed لا يقصّه overflow الأسلاف لأن سياقه الـ viewport */
  const simRoot = () => document.getElementById('fiber-sim-root') ?? document.body;

  const showTip = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const openUp = rect.top >= 110;
    setTipPos({
      right: Math.max(8, window.innerWidth - rect.right),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={showTip}
      onMouseLeave={() => setTipPos(null)}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
          active
            ? 'bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-400/60'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`}
      >
        {children}
      </button>
      {tipPos &&
        createPortal(
          <span
            style={{
              position: 'fixed',
              right: tipPos.right,
              top: tipPos.top,
              bottom: tipPos.bottom,
              maxWidth: 240,
              zIndex: 100000,
            }}
            className="pointer-events-none block whitespace-normal rounded-md bg-slate-800 px-2 py-1 text-center text-[11px] leading-snug text-slate-100 shadow-lg ring-1 ring-slate-700"
          >
            {label}
          </span>,
          simRoot()
        )}
    </div>
  );
}

export default function SimToolbar(): React.ReactElement {
  const st = useSimulatorStore();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  const zoom = (factor: number) => {
    const vp = st.viewport;
    const scale = Math.max(0.5, Math.min(60, vp.scale * factor));
    const cx = (window.innerWidth - 320) / 2;
    const cy = (window.innerHeight - 56) / 2;
    const wx = (cx - vp.tx) / vp.scale;
    const wy = (cy - vp.ty) / vp.scale;
    st.setViewport({ scale, tx: cx - wx * scale, ty: cy - wy * scale });
  };

  return (
    <div data-tour="toolbar" className="flex h-full w-16 flex-col items-center gap-0.5 overflow-y-auto border-slate-800 bg-slate-900/80 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TOOLS.map((t, i) => (
        <div key={t.id} className="flex flex-col items-center">
          {(i === 3 || i === 10) && <div className="my-0.5 h-px w-8 bg-slate-800" />}
          <div data-tour={t.tourId}>
            <ToolButton
              active={st.tool === t.id}
              label={t.label}
              onClick={() => st.setTool(t.id)}
            >
              <t.icon size={18} />
            </ToolButton>
          </div>
        </div>
      ))}

      {/* طرق الحفر عند تفعيل الأداة */}
      {st.tool === 'trench' && (
        <div className="mt-2 w-full space-y-1 rounded-lg bg-slate-950/60 p-1">
          {(Object.keys(TRENCH_METHODS) as TrenchMethod[]).map((m) => {
            const meta = TRENCH_METHODS[m];
            const active = st.trenchMethod === m;
            return (
              <button
                key={m}
                type="button"
                title={meta.note}
                onClick={() => st.setTrenchMethod(m)}
                className={`flex w-full items-center gap-1.5 rounded px-1 py-1 text-[10px] ${
                  active ? 'bg-slate-700/70 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                />
                <span className="leading-tight">{meta.nameAr}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="my-0.5 h-px w-8 bg-slate-800" />

      <ToolButton label="تراجع (Ctrl+Z)" onClick={simUndo} disabled={!canUndo}>
        <Undo2 size={18} />
      </ToolButton>
      <ToolButton label="إعادة (Ctrl+Y)" onClick={simRedo} disabled={!canRedo}>
        <Redo2 size={18} />
      </ToolButton>
      <ToolButton label="تكبير" onClick={() => zoom(1.25)}>
        <ZoomIn size={18} />
      </ToolButton>
      <ToolButton label="تصغير" onClick={() => zoom(0.8)}>
        <ZoomOut size={18} />
      </ToolButton>
      <ToolButton label="ملاءمة الخريطة" onClick={st.requestFit}>
        <Maximize2 size={18} />
      </ToolButton>

      <div className="my-0.5 h-px w-8 bg-slate-800" />

      <ToolButton
        label="مسح المشروع بالكامل"
        onClick={() => {
          if (window.confirm('سيتم مسح جميع عناصر التصميم. هل أنت متأكد؟')) st.clearAll();
        }}
      >
        <Trash2 size={18} />
      </ToolButton>
    </div>
  );
}
