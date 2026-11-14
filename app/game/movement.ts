const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// True when the distance shrank by more than the leeway across one Red light.
// Too few good readings is never "moved": standing still must not be caught.
export function moved(readings: number[], { leewayCm, laneCm }: { leewayCm: number; laneCm: number }) {
  const good = readings.filter((cm) => cm > 0 && cm <= laneCm);
  if (good.length < 4) return false;
  return median(good.slice(0, 3)) - median(good.slice(-3)) > leewayCm;
}
