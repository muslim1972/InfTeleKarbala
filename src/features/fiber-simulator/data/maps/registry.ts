/**
 * سجل خرائط المحاكي — إضافة خريطة جديدة تعني إدراجها هنا فقط.
 */

import type { SimMap } from '../../types';
import { ALLEY_16 } from './alley-16';

export const SIM_MAPS: SimMap[] = [ALLEY_16];

export const getMapById = (id: string): SimMap | undefined =>
  SIM_MAPS.find((m) => m.id === id);
