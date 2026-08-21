/** Mainland China (excluding HK, Macau, Taiwan bounding boxes). */
export function isChinaMainland(lat: number, lng: number): boolean {
  if (lat < 18.0 || lat > 53.6 || lng < 73.5 || lng > 134.8) return false;
  if (lat >= 22.1 && lat <= 22.6 && lng >= 113.8 && lng <= 114.5) return false;
  if (lat >= 22.1 && lat <= 22.25 && lng >= 113.5 && lng <= 113.65) return false;
  if (lat >= 21.8 && lat <= 25.4 && lng >= 119.3 && lng <= 122.1) return false;
  return true;
}
