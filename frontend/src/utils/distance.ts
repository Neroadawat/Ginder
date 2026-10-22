import {t} from '@/i18n';
/** Format a straight-line distance in the selected UI language. */
export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return t('{p0} ม.', {p0: Math.round(distanceKm * 1000)});
  }

  const kilometres = distanceKm.toFixed(1).replace(/\.0$/, '');
  return t('{p0} กม.', {p0: kilometres});
};
