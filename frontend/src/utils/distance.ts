/** Format a straight-line distance for the Thai restaurant UI. */
export const formatDistanceTh = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} ม.`;
  }

  const kilometres = distanceKm.toFixed(1).replace(/\.0$/, '');
  return `${kilometres} กม.`;
};
