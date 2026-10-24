export const LAT0 = 52.2, LON0 = 5.3, K = 100;
export const CL = Math.cos(LAT0 * Math.PI / 180);
export const KM_PER_UNIT = 111.32 / K;
export function toXY(lon, lat) { return { x: (lon - LON0) * CL * K, y: (lat - LAT0) * K }; }
