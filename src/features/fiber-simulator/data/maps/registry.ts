/**
 * سجل خرائط المحاكي.
 *  - إضافة خريطة ثابتة جديدة = إدراجها في SIM_MAPS هنا فقط.
 *  - الخرائط المستوردة من GIS تُسجَّل وقت التشغيل في مخزن معزول
 *    (gis-maps.store) ويتم دمجها هنا بشفافية — كل مستهلكات
 *    getMapById تحصل عليها تلقائياً دون أي تعديل.
 */

import type { SimMap } from '../../types';
import { ALLEY_16 } from './alley-16';
import { useGisMaps } from '../../gis/gis-maps.store';

export const SIM_MAPS: SimMap[] = [ALLEY_16];

export const getMapById = (id: string): SimMap | undefined =>
  SIM_MAPS.find((m) => m.id === id) ?? useGisMaps.getState().getMapById(id);
