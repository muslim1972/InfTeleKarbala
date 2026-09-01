/**
 * ============================================================
 * لوحة الرسم الهندسية (CAD Canvas) — محاكي FTTH
 * ============================================================
 * كل الإحداثيات بالمتر الحقيقي (World Units). اللوحة توفر:
 * شبكة إحداثية، خرائط، التقاطاً ذكياً، أدوات رسم تفاعلية،
 * تحريكاً وتكبيراً حراً، ومعاينة حية للمسودات والأطوال.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { Link2, ListOrdered, ArrowLeft, BookOpen, TriangleAlert } from 'lucide-react';
import type Konva from 'konva';
import { useSimulatorStore } from '../store/simulator.store';
import { useEduStore } from '../store/education.store';
import { getMapById } from '../data/maps/registry';
import { TRENCH_METHODS } from '../data/materials.catalog';
import { ELEMENT_INFO, type InfoKey } from '../education/element-info';
import { checkToolAllowed, type GuardResult } from '../education/build-order';
import {
  computeSnap,
  dist,
  nearestBuildingConnection,
  polylineLength,
  projectOnSegment,
  type NodeRef,
  type SnapResult,
} from '../engine/geometry';
import type { EntityKind, TrenchMethod, ToolId, Vec2 } from '../types';

const flat = (pts: Vec2[]): number[] => pts.flatMap((p) => [p.x, p.y]);

/** أدوات البناء التي تخضع لحرّاس ترتيب التسلسل */
const BUILD_TOOLS = new Set<ToolId>(['trench', 'manhole', 'handhole', 'fdc', 'fat', 'drop']);

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const SNAP_LABEL: Record<SnapResult['kind'], string> = {
  node: 'عقدة',
  path: 'مسار حفر',
  road: 'محور شارع',
  grid: 'شبكة',
  orthogonal: 'زاوية قياسية',
  free: 'حر',
};

export default function SimCanvas(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const [size, setSize] = useState({ w: 900, h: 600 });
  const [hover, setHover] = useState<{ world: Vec2; snap: SnapResult } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  /* نافذة التلميح العائمة — مفتاح العنصر + موقع الشاشة داخل الحاوية */
  const [hintPop, setHintPop] = useState<{ key: InfoKey; x: number; y: number } | null>(null);
  /* رسالة اعتراض خرق الترتيب */
  const [guard, setGuard] = useState<GuardResult | null>(null);
  const guardTimer = useRef<number>(0);
  /* نتيجة الالتقاط أثناء سحب عنصر — لتغذية شريط الحالة ومؤشر الالتقاط الحي */
  const [dragSnap, setDragSnap] = useState<SnapResult | null>(null);

  const edu = useEduStore();

  const panning = useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null);
  const moved = useRef(false);

  const st = useSimulatorStore();
  const { entities, tool, viewport: vp } = st;
  const map = getMapById(st.mapId);

  /* ===================== قياس الحاوية ===================== */
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* ===================== مفتاح المسافة للتحريك ===================== */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  /* تنظيف مؤقت رسالة الاعتراض عند الإزالة */
  useEffect(() => () => window.clearTimeout(guardTimer.current), []);

  /* مغادرة وضع التلميح تُخفي النافذة العائمة */
  useEffect(() => {
    if (tool !== 'hint') setHintPop(null);
  }, [tool]);

  /* ===================== ملاءمة العرض ===================== */
  useEffect(() => {
    if (!map || size.w < 50 || size.h < 50) return;
    const scale = Math.min(size.w / map.widthM, size.h / map.heightM) * 0.92;
    st.setViewport({
      scale,
      tx: (size.w - map.widthM * scale) / 2,
      ty: (size.h - map.heightM * scale) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map?.id, st.fitSignal, size.w, size.h]);

  /* ===================== عقد الالتقاط حسب الأداة ===================== */
  const snapNodes = useMemo<NodeRef[]>(() => {
    if (!map) return [];
    const nodes: NodeRef[] = [];
    if (tool === 'drop') {
      for (const b of map.buildings)
        nodes.push({ id: `b:${b.id}`, x: b.connectionPoint.x, y: b.connectionPoint.y });
      for (const f of entities.fats) nodes.push({ id: `f:${f.id}`, x: f.x, y: f.y });
    } else {
      for (const s of entities.structures) nodes.push({ id: `s:${s.id}`, x: s.x, y: s.y });
      for (const c of entities.cabinets) nodes.push({ id: `c:${c.id}`, x: c.x, y: c.y });
      for (const f of entities.fats) nodes.push({ id: `f:${f.id}`, x: f.x, y: f.y });
    }
    return nodes;
  }, [tool, entities.structures, entities.cabinets, entities.fats, map]);

  /* ===================== تحويلات الإحداثيات ===================== */
  const getWorld = (): Vec2 | null => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos || !map) return null;
    return { x: (pos.x - vp.tx) / vp.scale, y: (pos.y - vp.ty) / vp.scale };
  };

  const lastDraftPoint = (): Vec2 | null => {
    if (st.trenchDraft && st.trenchDraft.points.length)
      return st.trenchDraft.points[st.trenchDraft.points.length - 1];
    if (st.dropDraft && st.dropDraft.points.length)
      return st.dropDraft.points[st.dropDraft.points.length - 1];
    return null;
  };

  const doSnap = (raw: Vec2): SnapResult =>
    computeSnap(raw, {
      roads: map?.roads ?? [],
      /* مسارات الحفر القائمة: كي يلتصق FAT/FDC والمنشآت فوق المسار لا بجانبه */
      paths: entities.trenches.map((t) => t.points),
      nodes: snapNodes,
      tolM: 12 / vp.scale,
      orthogonalFrom:
        tool === 'trench' || tool === 'drop' ? lastDraftPoint() : null,
    });

  /* ===================== أحداث المؤشر ===================== */
  const onMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (panning.current) {
      const p = panning.current;
      const dx = e.evt.clientX - p.sx;
      const dy = e.evt.clientY - p.sy;
      /* لا يُعد «تحريكاً» إلا بعد تجاوز عتبة 3 بكسل — كي لا تُلغي الاهتزازات الدقيقة النقرات */
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      st.setViewport({
        scale: vp.scale,
        tx: p.tx + dx,
        ty: p.ty + dy,
      });
      return;
    }
    const w = getWorld();
    if (w && map) setHover({ world: w, snap: doSnap(w) });
  };

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    /* إصلاح حرج: يُصفَّر عند كل ضغطة — سابقاً كان يُصفَّر فقط عند بدء
       التحريك، فبقيت قيمته true بعد أول سحب للخريطة وتجاهلت لوحة
       الرسم كل نقرات أدوات الرسم إلى الأبد. */
    moved.current = false;
    const isPan = e.evt.button === 1 || tool === 'pan' || spaceDown;
    if (isPan) {
      panning.current = { sx: e.evt.clientX, sy: e.evt.clientY, tx: vp.tx, ty: vp.ty };
    }
  };

  const endPan = () => {
    panning.current = null;
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    const factor = Math.pow(1.15, e.evt.deltaY > 0 ? -1 : 1);
    const scale = clamp(vp.scale * factor, 0.5, 60);
    const wx = (pos.x - vp.tx) / vp.scale;
    const wy = (pos.y - vp.ty) / vp.scale;
    st.setViewport({ scale, tx: pos.x - wx * scale, ty: pos.y - wy * scale });
  };

  /* ===================== وضع التلميح التعليمي ===================== */
  /** فتح نافذة المعلومات العلمية عند نقرة عنصر — تتموضع قرب المؤشر داخل الحاوية */
  const openHint = (key: InfoKey, e: Konva.KonvaEventObject<MouseEvent>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const POP_W = 300;
    const POP_MAX_H = 360;
    const x = Math.min(Math.max(8, e.evt.clientX - rect.left + 12), Math.max(8, rect.width - POP_W - 8));
    const rawY = e.evt.clientY - rect.top + 12;
    const y = rawY + POP_MAX_H > rect.height ? Math.max(8, rawY - POP_MAX_H - 24) : rawY;
    setHintPop({ key, x, y });
    edu.markExplored(key);
  };

  /** حلّ مفتاح المعلومات لكيان مشروع (المنشآت تفرّق منهل/هاند هول) */
  const infoKeyForEntity = (kind: EntityKind, id: string): InfoKey => {
    if (kind === 'structure') {
      const s = entities.structures.find((x) => x.id === id);
      return s?.kind === 'handhole' ? 'handhole' : 'manhole';
    }
    if (kind === 'trench') return 'trench';
    if (kind === 'cabinet') return 'fdc';
    if (kind === 'fat') return 'fat';
    return 'drop';
  };

  /**
   * كشف العناصر الثابتة للخريطة (المقسم/الدور/الشارع) تحت نقرة المؤشر.
   * هذه العناصر مرسومة بلا استماع للأحداث، لذا يمر نقرها إلى المسرح —
   * ووضع التلميح يفرّغها عبر اختبار مسافة هندسي.
   */
  const infoKeyAtWorld = (p: Vec2): InfoKey | null => {
    if (!map) return null;
    /* المقسم — مربّع 4×2.4م حول نقطته */
    if (Math.abs(p.x - map.exchange.point.x) <= 3.5 && Math.abs(p.y - map.exchange.point.y) <= 3.5)
      return 'exchange';
    /* الدور — مستطيل 10×10م بهامش متر */
    const inBuilding = map.buildings.some((b) => {
      const minX = b.polygon.reduce((m, q) => Math.min(m, q.x), Infinity);
      const minY = b.polygon.reduce((m, q) => Math.min(m, q.y), Infinity);
      return p.x >= minX - 1 && p.x <= minX + 11 && p.y >= minY - 1 && p.y <= minY + 11;
    });
    if (inBuilding) return 'home';
    /* الشوارع — ضمن نصف عرض الشارع + متر هوامش */
    const nearRoad = map.roads.some((r) => {
      for (let i = 1; i < r.centerline.length; i++) {
        if (projectOnSegment(p, r.centerline[i - 1], r.centerline[i]).dist <= r.width / 2 + 1)
          return true;
      }
      return false;
    });
    if (nearRoad) return 'road';
    return null;
  };

  /* ===================== رسالة اعتراض خرق الترتيب ===================== */
  /** تعرض البطاقة وتسجل الخطأ في السجل التعليمي ثم تُخفيها تلقائياً */
  const showGuard = (g: GuardResult) => {
    window.clearTimeout(guardTimer.current);
    setGuard(g);
    edu.logError({
      code: g.code ?? 'ORDER_UNKNOWN',
      severity: 'warn',
      titleAr: g.titleAr ?? 'ترتيب خاطئ',
      messageAr: g.messageAr ?? '',
      lessonAr: g.lessonAr ?? '',
    });
    guardTimer.current = window.setTimeout(() => setGuard(null), 8000);
  };

  /* ===================== نقرات الأدوات ===================== */
  const onEntityClick = (kind: EntityKind, id: string) => (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (tool === 'hint') {
      openHint(infoKeyForEntity(kind, id), e);
      return;
    }
    if (tool === 'eraser') st.removeEntity(kind, id);
    else if (tool === 'select') st.setSelection([id]);
  };

  const handleDropClick = (p: Vec2) => {
    if (!map) return;
    if (!st.dropDraft) {
      const fat = entities.fats.find((f) => dist(p, { x: f.x, y: f.y }) <= 3);
      if (fat) st.beginDrop(fat.id, { x: fat.x, y: fat.y });
      return;
    }
    const b = nearestBuildingConnection(p, map.buildings, 5);
    if (b) {
      st.extendDrop(b.point);
      st.commitDrop(b.id);
    } else {
      st.extendDrop(p);
    }
  };

  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (moved.current || e.evt.button !== 0 || !map) return;
    const world = getWorld();
    if (!world) return;
    const p = hover?.snap.point ?? doSnap(world).point;

    /* وضع التلميح: كشف العناصر الثابتة (المقسم/الدار/الشارع) —
       والنقر على فراغ يُخفي النافذة العائمة كي لا تحجب المخطط */
    if (tool === 'hint') {
      const key = infoKeyAtWorld(world);
      if (key) openHint(key, e);
      else setHintPop(null);
      return;
    }

    /* حرّاس الترتيب التعليمي: أدوات البناء ممنوعة قبل استيفاء خطواتها السابقة */
    if (BUILD_TOOLS.has(tool)) {
      const g = checkToolAllowed(tool, entities);
      if (!g.ok) {
        showGuard(g);
        return;
      }
    }

    switch (tool) {
      case 'trench':
        if (!st.trenchDraft) st.beginTrench(p);
        else st.extendTrench(p);
        break;
      case 'manhole':
      case 'handhole':
        st.placeStructure(tool, p.x, p.y);
        break;
      case 'fdc':
        st.placeCabinet(p.x, p.y);
        break;
      case 'fat':
        st.placeFat(p.x, p.y);
        break;
      case 'drop':
        handleDropClick(p);
        break;
      case 'measure':
        if (!st.measureFrom || st.measureTo) st.setMeasure(p, null);
        else st.setMeasure(st.measureFrom, p);
        break;
      default:
        if (e.target === e.target.getStage() || e.target.name() === 'bg')
          st.setSelection([]);
    }
  };

  const onDblClick = () => {
    if (tool === 'trench' && st.trenchDraft) st.commitTrench();
  };

  const onContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (st.trenchDraft) st.cancelTrench();
    if (st.dropDraft) st.cancelDrop();
    st.setMeasure(null, null);
  };

  /* ===================== سحب الكيانات الموضوعة (تحريك) ===================== */
  /** مفتاح عقدة الالتقاط لكل نوع كيان — لاستثناء العنصر المسحوب نفسه من الالتقاط
      (وإلا علق في موضعه الأصلي عند بدء السحب) */
  const nodeKeyOf = (kind: 'structure' | 'cabinet' | 'fat', id: string): string =>
    kind === 'structure' ? `s:${id}` : kind === 'cabinet' ? `c:${id}` : `f:${id}`;

  /**
   * التقاط حي أثناء السحب عبر computeSnap الكامل (عقد ← مسارات حفر ← شوارع ← شبكة):
   * - العنصر يلتصق فور اقترابه من هدف قريب (لا يلتصق في الفراغ).
   * - شريط الحالة والمؤشر الدائري يحدَّثان لحظياً بإحداثيات عالمية صحيحة
   *   (المجموعات موضوعة على إحداثيات الكيان ذاته فتطابق node.x()/y() العالم).
   */
  const onEntityDragMove =
    (kind: 'structure' | 'cabinet' | 'fat', id: string) =>
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!map) return;
      const node = e.target;
      const snap = computeSnap({ x: node.x(), y: node.y() }, {
        roads: map.roads,
        paths: entities.trenches.map((t) => t.points),
        nodes: snapNodes.filter((n) => n.id !== nodeKeyOf(kind, id)),
        tolM: Math.max(2, 12 / vp.scale),
        orthogonalFrom: null,
      });
      /* الالتصاق فقط عند وجود هدف قريب — الحركة الحرة تبقى حرة */
      if (snap.kind !== 'free') node.position({ x: snap.point.x, y: snap.point.y });
      const final = node.position();
      setHover({ world: final, snap });
      setDragSnap(snap.kind !== 'free' ? snap : null);
    };

  const onEntityDragEnd =
    (kind: 'structure' | 'cabinet' | 'fat', id: string) =>
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      st.moveEntity(kind, id, node.x(), node.y());
      setDragSnap(null);
    };

  if (!map) return <div className="flex h-full items-center justify-center text-slate-400">الخريطة غير موجودة</div>;

  /* ===================== عناصر الشبكة ===================== */
  const gridElems: React.ReactNode[] = [];
  const minor = vp.scale >= 9;
  for (let x = 0; x <= map.widthM; x += 10) {
    gridElems.push(
      <Line key={`Mx${x}`} points={[x, 0, x, map.heightM]} stroke="#223047" strokeWidth={0.1} listening={false} />
    );
  }
  for (let y = 0; y <= map.heightM; y += 10) {
    gridElems.push(
      <Line key={`My${y}`} points={[0, y, map.widthM, y]} stroke="#223047" strokeWidth={0.1} listening={false} />
    );
  }
  if (minor) {
    for (let x = 0; x <= map.widthM; x++) {
      if (x % 10 === 0) continue;
      gridElems.push(
        <Line key={`mx${x}`} points={[x, 0, x, map.heightM]} stroke="#16213a" strokeWidth={0.05} listening={false} />
      );
    }
    for (let y = 0; y <= map.heightM; y++) {
      if (y % 10 === 0) continue;
      gridElems.push(
        <Line key={`my${y}`} points={[0, y, map.widthM, y]} stroke="#16213a" strokeWidth={0.05} listening={false} />
      );
    }
  }

  /* ===================== حالات العرض ===================== */
  const isSel = (id: string) => st.selectedIds.includes(id);
  const draftLen = st.trenchDraft ? polylineLength(st.trenchDraft.points) : null;
  const dropDraftLen = st.dropDraft ? polylineLength(st.dropDraft.points) : null;
  const measureLen = st.measureFrom && st.measureTo ? dist(st.measureFrom, st.measureTo) : null;

  /* مؤشر الالتقاط: لأدوات الرسم عند المرور، أو لحظياً أثناء سحب عنصر */
  const snapCursor: SnapResult | null =
    dragSnap ??
    (hover && (tool === 'trench' || tool === 'drop' || tool === 'measure' || tool === 'fat' || tool === 'fdc')
      ? hover.snap
      : null);

  const cursor =
    tool === 'pan' || spaceDown
      ? 'grab'
      : tool === 'select'
        ? 'default'
        : tool === 'hint'
          ? 'help'
          : tool === 'eraser'
            ? 'pointer'
            : 'crosshair';

  /* ترجمة عربية لطريقة الحفر */
  const methodMeta = (m: TrenchMethod) => TRENCH_METHODS[m];

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#0a1120]">
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        style={{ cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        onWheel={onWheel}
        onClick={onStageClick}
        onDblClick={onDblClick}
        onContextMenu={onContextMenu}
      >
        <Layer x={vp.tx} y={vp.ty} scaleX={vp.scale} scaleY={vp.scale}>
          {/* خلفية قابلة للنقر */}
          <Rect
            name="bg"
            x={-400}
            y={-400}
            width={map.widthM + 800}
            height={map.heightM + 800}
            fill="#0a1120"
          />

          {/* الشبكة والحدود */}
          {gridElems}
          <Rect
            x={0}
            y={0}
            width={map.widthM}
            height={map.heightM}
            stroke="#2e3d57"
            strokeWidth={0.15}
            listening={false}
          />

          {/* الشوارع */}
          {map.roads.map((r) => (
            <Group key={r.id} listening={false}>
              <Line
                points={flat(r.centerline)}
                stroke={r.surface === 'asphalt' ? '#39434f' : '#4a4234'}
                strokeWidth={r.width}
                lineCap="round"
                lineJoin="round"
              />
              <Line
                points={flat(r.centerline)}
                stroke="#5d6b7d"
                strokeWidth={0.18}
                dash={[2.5, 2.5]}
              />
              <Text
                x={r.centerline[0].x}
                y={r.centerline[0].y - r.width / 2 - 4}
                fontSize={2.6}
                fill="#7d8aa0"
                text={r.name}
              />
            </Group>
          ))}

          {/* المقسم */}
          <Group listening={false}>
            <Rect
              x={map.exchange.point.x - 2}
              y={map.exchange.point.y - 1.2}
              width={4}
              height={2.4}
              fill="#075985"
              stroke="#38bdf8"
              strokeWidth={0.15}
              cornerRadius={0.3}
            />
            <Text
              x={map.exchange.point.x - 10}
              y={map.exchange.point.y + 1.6}
              width={20}
              align="center"
              fontSize={2.4}
              fill="#7dd3fc"
              text={map.exchange.label}
            />
          </Group>

          {/* الدور */}
          {map.buildings.map((b) => (
            <Group key={b.id} listening={false}>
              <Rect
                x={b.polygon.reduce((m, p) => Math.min(m, p.x), Infinity)}
                y={b.polygon.reduce((m, p) => Math.min(m, p.y), Infinity)}
                width={10}
                height={10}
                fill="#1b2536"
                stroke="#54657f"
                strokeWidth={0.15}
              />
              <Text
                x={b.polygon[0].x}
                y={b.polygon[0].y + 3}
                width={10}
                align="center"
                fontSize={3}
                fill="#93a6c4"
                text={b.label}
              />
              <Circle
                x={b.connectionPoint.x}
                y={b.connectionPoint.y}
                radius={0.55}
                fill={tool === 'drop' ? '#0ea5e9' : '#334155'}
                stroke="#38bdf8"
                strokeWidth={0.12}
                opacity={tool === 'drop' ? 1 : 0.5}
              />
            </Group>
          ))}

          {/* مسارات الحفر */}
          {entities.trenches.map((t) => (
            <Group key={t.id}>
              <Line
                points={flat(t.points)}
                stroke={methodMeta(t.method).color}
                strokeWidth={isSel(t.id) ? 1.7 : 1.1}
                opacity={isSel(t.id) ? 1 : 0.85}
                lineCap="round"
                lineJoin="round"
                hitStrokeWidth={3}
                onClick={onEntityClick('trench', t.id)}
              />
              {isSel(t.id) &&
                t.points.map((p, i) => (
                  <Circle key={i} x={p.x} y={p.y} radius={0.4} fill="#fff" listening={false} />
                ))}
            </Group>
          ))}

          {/* المنشآت (مناهل/هاند هول) — المجموعة على إحداثيات الكيان والمحتوى نسبي
              كي يطابق node.x()/y() أثناء السحب الإحداثيات العالمية */}
          {entities.structures.map((s) => {
            const w = s.kind === 'manhole' ? 1.8 : 1.0;
            return (
              <Group
                key={s.id}
                x={s.x}
                y={s.y}
                onClick={onEntityClick('structure', s.id)}
                draggable={tool === 'select'}
                onDragMove={onEntityDragMove('structure', s.id)}
                onDragEnd={onEntityDragEnd('structure', s.id)}
              >
                <Rect
                  x={-w / 2}
                  y={-w / 2}
                  width={w}
                  height={w}
                  fill={s.kind === 'manhole' ? '#475569' : '#64748b'}
                  stroke={isSel(s.id) ? '#fff' : '#94a3b8'}
                  strokeWidth={0.12}
                  cornerRadius={0.2}
                />
                {s.kind === 'manhole' && (
                  <Circle x={0} y={0} radius={0.45} stroke="#cbd5e1" strokeWidth={0.1} listening={false} />
                )}
              </Group>
            );
          })}

          {/* الكبائن FDC — المجموعة على إحداثيات الكيان والمحتوى نسبي */}
          {entities.cabinets.map((c) => (
            <Group
              key={c.id}
              x={c.x}
              y={c.y}
              onClick={onEntityClick('cabinet', c.id)}
              draggable={tool === 'select'}
              onDragMove={onEntityDragMove('cabinet', c.id)}
              onDragEnd={onEntityDragEnd('cabinet', c.id)}
            >
              <Rect
                x={-1.3}
                y={-1}
                width={2.6}
                height={2}
                fill="#0c4a6e"
                stroke={isSel(c.id) ? '#fff' : '#38bdf8'}
                strokeWidth={0.15}
                cornerRadius={0.25}
              />
              <Text
                x={-1.3}
                y={-0.8}
                width={2.6}
                align="center"
                fontSize={1.5}
                fill="#bae6fd"
                text={`FDC ${c.capacityF}F`}
              />
            </Group>
          ))}

          {/* صناديق FAT — المجموعة على إحداثيات الكيان والمحتوى نسبي */}
          {entities.fats.map((f) => (
            <Group
              key={f.id}
              x={f.x}
              y={f.y}
              onClick={onEntityClick('fat', f.id)}
              draggable={tool === 'select'}
              onDragMove={onEntityDragMove('fat', f.id)}
              onDragEnd={onEntityDragEnd('fat', f.id)}
            >
              <Rect
                x={-0.7}
                y={-0.5}
                width={1.4}
                height={1}
                fill="#14532d"
                stroke={isSel(f.id) ? '#fff' : f.splitter ? '#4ade80' : '#f87171'}
                strokeWidth={0.15}
                cornerRadius={0.2}
              />
              <Text
                x={-0.7}
                y={-0.45}
                width={1.4}
                align="center"
                fontSize={0.9}
                fill="#bbf7d0"
                text={`FAT${f.ports}`}
              />
            </Group>
          ))}

          {/* كابلات الإسقاط */}
          {entities.drops.map((d) => (
            <Line
              key={d.id}
              points={flat(d.points)}
              stroke="#eab308"
              strokeWidth={0.35}
              dash={[0.8, 0.4]}
              opacity={isSel(d.id) ? 1 : 0.8}
              hitStrokeWidth={2.5}
              onClick={onEntityClick('drop', d.id)}
            />
          ))}

          {/* مسودة الحفر الجاري */}
          {st.trenchDraft && (
            <Group listening={false}>
              <Line
                points={flat(st.trenchDraft.points)}
                stroke={methodMeta(st.trenchDraft.method).color}
                strokeWidth={1.1}
                lineCap="round"
              />
              {st.trenchDraft.points.map((p, i) => (
                <Circle key={i} x={p.x} y={p.y} radius={0.45} fill="#fff" />
              ))}
              {hover && (
                <Line
                  points={flat([
                    st.trenchDraft.points[st.trenchDraft.points.length - 1],
                    hover.snap.point,
                  ])}
                  stroke="#e2e8f0"
                  strokeWidth={0.3}
                  dash={[0.7, 0.5]}
                  opacity={0.7}
                />
              )}
            </Group>
          )}

          {/* مسودة الإسقاط الجاري */}
          {st.dropDraft && (
            <Group listening={false}>
              <Line
                points={flat(st.dropDraft.points)}
                stroke="#fde047"
                strokeWidth={0.4}
                dash={[0.8, 0.4]}
              />
              {hover && (
                <Line
                  points={flat([
                    st.dropDraft.points[st.dropDraft.points.length - 1],
                    hover.snap.point,
                  ])}
                  stroke="#fef08a"
                  strokeWidth={0.3}
                  dash={[0.6, 0.4]}
                  opacity={0.8}
                />
              )}
            </Group>
          )}

          {/* أداة القياس */}
          {st.measureFrom && (
            <Group listening={false}>
              {st.measureTo && (
                <Line
                  points={flat([st.measureFrom, st.measureTo])}
                  stroke="#a5b4fc"
                  strokeWidth={0.25}
                  dash={[1, 0.6]}
                />
              )}
              <Circle x={st.measureFrom.x} y={st.measureFrom.y} radius={0.5} fill="#a5b4fc" />
              {st.measureTo && (
                <Circle x={st.measureTo.x} y={st.measureTo.y} radius={0.5} fill="#a5b4fc" />
              )}
              {measureLen !== null && st.measureTo && (
                <Text
                  x={(st.measureFrom.x + st.measureTo.x) / 2 + 1}
                  y={(st.measureFrom.y + st.measureTo.y) / 2}
                  fontSize={3}
                  fill="#c7d2fe"
                  text={`${measureLen.toFixed(1)} م`}
                />
              )}
            </Group>
          )}

          {/* مؤشر الالتقاط — يظهر لأدوات الرسم وعند سحب عنصر قرب هدف */}
          {snapCursor && (
            <Group listening={false}>
              <Circle
                x={snapCursor.point.x}
                y={snapCursor.point.y}
                radius={0.7}
                stroke="#f8fafc"
                strokeWidth={0.15}
                dash={[0.4, 0.3]}
              />
            </Group>
          )}
        </Layer>
      </Stage>

      {/* شريط الحالة السفلي */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-4 px-3 py-1.5 text-[11px] text-slate-400"
        style={{ background: 'rgba(7,12,22,0.82)' }}
        dir="rtl"
      >
        <span>
          x: {hover ? hover.world.x.toFixed(1) : '—'} / y: {hover ? hover.world.y.toFixed(1) : '—'} م
        </span>
        <span>الالتقاط: {hover ? SNAP_LABEL[hover.snap.kind] : '—'}</span>
        <span>التكبير: {(vp.scale * 100 / 4).toFixed(0)}%</span>
        {draftLen !== null && <span className="text-amber-300">طول المسار: {draftLen.toFixed(1)} م</span>}
        {dropDraftLen !== null && <span className="text-yellow-200">طول الإسقاط: {dropDraftLen.toFixed(1)} م</span>}
        <span className="mr-auto text-slate-500">
          نقرة يسرى: إضافة · نقرة مزدوجة/Enter: إنهاء · يمين/Esc: إلغاء · مسافة+سحب: تحريك الخريطة · سحب العناصر بأداة التحديد: تحريكها مع الالتصاق بالمسار · عجلة: تكبير
        </span>
      </div>

      {/* ===================== نافذة التلميح العائمة ===================== */}
      {hintPop &&
        (() => {
          const info = ELEMENT_INFO[hintPop.key];
          return (
            <div
              dir="rtl"
              onMouseLeave={() => setHintPop(null)}
              className="absolute z-30 max-h-[360px] w-[300px] overflow-y-auto rounded-xl border border-sky-500/40 bg-[#0b1628] p-3.5 shadow-2xl shadow-black/70"
              style={{ left: hintPop.x, top: hintPop.y }}
            >
              {/* الرأس: الاسم + المصطلح + رقم الخطوة */}
              <div className="mb-2 flex items-start gap-2 border-b border-slate-700/60 pb-2">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-sky-200">{info.titleAr}</div>
                  <div className="text-[10.5px] font-mono tracking-wide text-slate-500" dir="ltr">
                    {info.termEn}
                  </div>
                </div>
                <span className="mr-auto shrink-0 rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-sky-300">
                  خطوة {info.orderNo}/{info.orderTotal}
                </span>
              </div>

              {/* ما هو؟ — المعلومات العلمية */}
              <p className="text-[12.5px] leading-[1.75] text-slate-300">{info.whatAr}</p>

              {/* وظيفته في الشبكة */}
              <div className="mt-2 rounded-lg bg-sky-500/10 px-2 py-1.5 text-[12px] leading-[1.65] text-sky-200">
                <span className="font-semibold">وظيفته: </span>
                {info.roleAr}
              </div>

              {/* الترتيب الصحيح أثناء البناء */}
              <div className="mt-2 space-y-1.5 border-t border-slate-700/60 pt-2 text-[12px] leading-[1.65]">
                <div className="flex gap-1.5">
                  <ListOrdered className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <p className="text-slate-300">
                    <span className="font-semibold text-amber-300">يأتي بعد: </span>
                    {info.comesAfterAr}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  <p className="text-slate-300">
                    <span className="font-semibold text-indigo-300">يرتبط بـ/يعتمد على: </span>
                    {info.dependsAr}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <ArrowLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <p className="text-slate-300">
                    <span className="font-semibold text-emerald-300">تليه خطوات: </span>
                    {info.nextAr}
                  </p>
                </div>
              </div>

              {/* المرجع القياسي العالمي */}
              {info.standardAr && (
                <div
                  className="mt-2 rounded-lg border border-slate-700/70 bg-slate-800/40 px-2 py-1.5 text-[11px] leading-[1.6] text-slate-400"
                  dir="rtl"
                >
                  <span className="font-semibold text-slate-300">المرجع القياسي: </span>
                  {info.standardAr}
                </div>
              )}

              <p className="mt-2 text-center text-[10px] text-slate-600">
                أخرج المؤشر من النافذة أو انقر عنصراً آخر لإخفائها
              </p>
            </div>
          );
        })()}

      {/* ===================== رسالة اعتراض خرق الترتيب ===================== */}
      {guard && (
        <div
          dir="rtl"
          onClick={() => setGuard(null)}
          className="absolute left-1/2 top-4 z-30 max-w-[380px] -translate-x-1/2 cursor-pointer rounded-xl border border-amber-500/50 bg-[#1f1608]/95 p-3 shadow-2xl shadow-black/70"
        >
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-amber-300">{guard.titleAr}</div>
              <p className="mt-1 text-[12.5px] leading-[1.7] text-slate-200">{guard.messageAr}</p>
              {guard.lessonAr && (
                <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11.5px] leading-[1.65] text-amber-200/90">
                  <span className="font-semibold">الدرس المستفاد: </span>
                  {guard.lessonAr}
                </p>
              )}
              {guard.requiredStep && (
                <p className="mt-1.5 text-[11.5px] text-sky-300">
                  <span className="font-semibold">الخطوة المطلوبة الآن: </span>
                  {guard.requiredStep.order}. {guard.requiredStep.titleAr} — {guard.requiredStep.goalAr}
                </p>
              )}
              <p className="mt-1.5 text-[10px] text-slate-500">انقر للإخفاء · تُسجَّل هذه الأخطاء في سجل التعلّم الخاص بك</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
