/**
 * ============================================================
 * خدمة نتائج ومشاريع المحاكي — جداول fiber_sim_* المعزولة
 * ============================================================
 * لا تلمس أي جدول من التطبيق الأساسي. الاستيراد الوحيد من
 * الخارج هو عميل Supabase المشترك (بنفس نمط بقية التطبيق).
 */

import { supabase } from '../../../lib/supabase';
import type { ProjectEntities } from '../types';
import type { PhaseId } from '../types';
import type { ScoreResult } from '../engine/scoring';

export interface FiberScoreRow {
  id: string;
  map_id: string;
  total_cost_usd: number;
  coverage_homes: number;
  optical_pass: boolean;
  stars: number;
  details: Record<string, unknown>;
  created_at: string;
}

export interface FiberProjectRow {
  id: string;
  map_id: string;
  name: string;
  phase: PhaseId;
  entities: ProjectEntities;
  updated_at: string;
}

/* ===================== حفظ نتيجة محاولة ===================== */

export async function saveFiberScore(input: {
  userId: string;
  mapId: string;
  totalCostUSD: number;
  coverageHomes: number;
  opticalPass: boolean;
  score: ScoreResult;
}): Promise<void> {
  const { error } = await supabase.from('fiber_sim_scores').insert({
    user_id: input.userId,
    map_id: input.mapId,
    total_cost_usd: Math.round(input.totalCostUSD * 100) / 100,
    coverage_homes: input.coverageHomes,
    optical_pass: input.opticalPass,
    stars: Math.round(input.score.stars),
    details: {
      percentage: input.score.percentage,
      title: input.score.titleAr,
      criteria: input.score.criteria.map((c) => ({
        id: c.id,
        label: c.labelAr,
        earnedPct: c.earnedPct,
        points: Math.round(c.points * 10) / 10,
        weight: c.weight,
        detail: c.detailAr,
      })),
    },
  });
  if (error) throw new Error(`تعذر حفظ النتيجة: ${error.message}`);
}

/* ===================== أفضل النتائج لخريطة ===================== */

export async function fetchBestFiberScore(
  userId: string,
  mapId: string
): Promise<FiberScoreRow | null> {
  const { data, error } = await supabase
    .from('fiber_sim_scores')
    .select('*')
    .eq('user_id', userId)
    .eq('map_id', mapId)
    .order('stars', { ascending: false })
    .order('total_cost_usd', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`تعذر جلب النتائج: ${error.message}`);
  return (data as FiberScoreRow | null) ?? null;
}

/* ===================== مشاريع متعددة مسماة =====================
 * كل مستخدم يملك مجموعة مشاريع مستقلة؛ الاسم مميز له (فهرس
 * فريد uq_fiber_sim_projects_user_name). الحفظ فوق مشروع قائم
 * يتم بمعرّفه لا باسمه، و«حفظ باسم جديد» يُدرج صفاً جديداً.
 */

/** قائمة كل مشاريع المستخدم — الأحدث تعديلاً أولاً */
export async function listFiberProjects(userId: string): Promise<FiberProjectRow[]> {
  const { data, error } = await supabase
    .from('fiber_sim_projects')
    .select('id, map_id, name, phase, entities, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`تعذر جلب قائمة المشاريع: ${error.message}`);
  return (data as FiberProjectRow[]) ?? [];
}

/** حفظ فوق مشروع قائم — بالمعرّف حصراً لتفادي أي تضارب أسماء */
export async function updateFiberProject(
  userId: string,
  projectId: string,
  input: { name: string; phase: PhaseId; entities: ProjectEntities }
): Promise<void> {
  const { error } = await supabase
    .from('fiber_sim_projects')
    .update({
      name: input.name,
      phase: input.phase,
      entities: input.entities,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('user_id', userId);
  if (error) throw new Error(`تعذر تحديث المشروع: ${error.message}`);
}

/** حفظ نسخة جديدة (Save As) — يرفض الاسم المكرر برسالة واضحة */
export async function insertFiberProject(input: {
  userId: string;
  mapId: string;
  name: string;
  phase: PhaseId;
  entities: ProjectEntities;
}): Promise<FiberProjectRow> {
  const { data, error } = await supabase
    .from('fiber_sim_projects')
    .insert({
      user_id: input.userId,
      map_id: input.mapId,
      name: input.name,
      phase: input.phase,
      entities: input.entities,
    })
    .select('id, map_id, name, phase, entities, updated_at')
    .single();
  if (error) {
    /* 23505 = خرق قيد التفرد (اسم مستخدم مسبقاً) */
    if (error.code === '23505')
      throw new Error(`يوجد مشروع محفوظ بالاسم «${input.name}» — اختر اسماً مختلفاً`);
    throw new Error(`تعذر حفظ المشروع: ${error.message}`);
  }
  return data as FiberProjectRow;
}

/** حذف مشروع — مقيد بمالكه */
export async function deleteFiberProject(userId: string, projectId: string): Promise<void> {
  const { error } = await supabase
    .from('fiber_sim_projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId);
  if (error) throw new Error(`تعذر حذف المشروع: ${error.message}`);
}

/** أحدث مشروع محفوظ لخريطة معينة — للاسترجاع التلقائي عند الفتح */
export async function loadFiberProject(
  userId: string,
  mapId: string
): Promise<FiberProjectRow | null> {
  const { data, error } = await supabase
    .from('fiber_sim_projects')
    .select('id, map_id, name, phase, entities, updated_at')
    .eq('user_id', userId)
    .eq('map_id', mapId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`تعذر جلب المشروع: ${error.message}`);
  return (data as FiberProjectRow | null) ?? null;
}
