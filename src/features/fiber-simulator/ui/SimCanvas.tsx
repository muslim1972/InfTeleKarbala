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
import type Konva from 'konva';
import { useSimulatorStore } from '../store/simulator.store';
import { getMapById } from '../data/maps/registry';
import { TRENCH_METHODS } from '../data/materials.catalog';
import {
  computeSnap,
  dist,
  nearestBuildingConnection,
  polylineLength,
  type NodeRef,
  type SnapResult,
} from '../engine/geometry';
import type { EntityKind, TrenchMethod, Vec2 } from '../types';

const flat = (pts: Vec2[]): number[] => pts.flatMap((p) => [p.x, p.y]);

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const SNAP_LABEL: Record<SnapResult['kind'], string> = {
  node: 'عقدة',
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
      nodes: snapNodes,
      tolM: 12 / vp.scale,
      orthogonalFrom:
        tool === 'trench' || tool === 'drop' ? lastDraftPoint() : null,
    });

  /* ===================== أحداث المؤشر ===================== */
  const onMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (panning.current) {
      moved.current = true;
      const p = panning.current;
      st.setViewport({
        scale: vp.scale,
        tx: p.tx + (e.evt.clientX - p.sx),
        ty: p.ty + (e.evt.clientY - p.sy),
      });
      return;
    }
    const w = getWorld();
    if (w && map) setHover({ world: w, snap: doSnap(w) });
  };

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const isPan = e.evt.button === 1 || tool === 'pan' || spaceDown;
    if (isPan) {
      panning.current = { sx: e.evt.clientX, sy: e.evt.clientY, tx: vp.tx, ty: vp.ty };
      moved.current = false;
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

  /* ===================== نقرات الأدوات ===================== */
  const onEntityClick = (kind: EntityKind, id: string) => (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
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

  const cursor =
    tool === 'pan' || spaceDown ? 'grab' : tool === 'select' ? 'default' : tool === 'eraser' ? 'pointer' : 'crosshair';

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

          {/* المنشآت (مناهل/هاند هول) */}
          {entities.structures.map((s) => {
            const w = s.kind === 'manhole' ? 1.8 : 1.0;
            return (
              <Group key={s.id} onClick={onEntityClick('structure', s.id)}>
                <Rect
                  x={s.x - w / 2}
                  y={s.y - w / 2}
                  width={w}
                  height={w}
                  fill={s.kind === 'manhole' ? '#475569' : '#64748b'}
                  stroke={isSel(s.id) ? '#fff' : '#94a3b8'}
                  strokeWidth={0.12}
                  cornerRadius={0.2}
                />
                {s.kind === 'manhole' && (
                  <Circle x={s.x} y={s.y} radius={0.45} stroke="#cbd5e1" strokeWidth={0.1} listening={false} />
                )}
              </Group>
            );
          })}

          {/* الكبائن FDC */}
          {entities.cabinets.map((c) => (
            <Group key={c.id} onClick={onEntityClick('cabinet', c.id)}>
              <Rect
                x={c.x - 1.3}
                y={c.y - 1}
                width={2.6}
                height={2}
                fill="#0c4a6e"
                stroke={isSel(c.id) ? '#fff' : '#38bdf8'}
                strokeWidth={0.15}
                cornerRadius={0.25}
              />
              <Text
                x={c.x - 1.3}
                y={c.y - 0.8}
                width={2.6}
                align="center"
                fontSize={1.5}
                fill="#bae6fd"
                text={`FDC ${c.capacityF}F`}
              />
            </Group>
          ))}

          {/* صناديق FAT */}
          {entities.fats.map((f) => (
            <Group key={f.id} onClick={onEntityClick('fat', f.id)}>
              <Rect
                x={f.x - 0.7}
                y={f.y - 0.5}
                width={1.4}
                height={1}
                fill="#14532d"
                stroke={isSel(f.id) ? '#fff' : f.splitter ? '#4ade80' : '#f87171'}
                strokeWidth={0.15}
                cornerRadius={0.2}
              />
              <Text
                x={f.x - 0.7}
                y={f.y - 0.45}
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

          {/* مؤشر الالتقاط */}
          {hover && (tool === 'trench' || tool === 'drop' || tool === 'measure') && (
            <Group listening={false}>
              <Circle
                x={hover.snap.point.x}
                y={hover.snap.point.y}
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
          س: {hover ? hover.world.x.toFixed(1) : '—'} / ص: {hover ? hover.world.y.toFixed(1) : '—'} م
        </span>
        <span>الالتقاط: {hover ? SNAP_LABEL[hover.snap.kind] : '—'}</span>
        <span>التكبير: {(vp.scale * 100 / 4).toFixed(0)}%</span>
        {draftLen !== null && <span className="text-amber-300">طول المسار: {draftLen.toFixed(1)} م</span>}
        {dropDraftLen !== null && <span className="text-yellow-200">طول الإسقاط: {dropDraftLen.toFixed(1)} م</span>}
        <span className="mr-auto text-slate-500">
          نقرة يسرى: إضافة · نقرة مزدوجة/Enter: إنهاء · يمين/Esc: إلغاء · مسافة+سحب: تحريك · عجلة: تكبير
        </span>
      </div>
    </div>
  );
}
