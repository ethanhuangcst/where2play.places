/**
 * Coarsen a reverse-geocode label to city-level when possible.
 * Keeps "City, Country" / "XX市"; drops street-level detail.
 */
export function toCityLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;

  const cityCn = trimmed.match(
    /([\u4e00-\u9fff]{2,12}(?:特别行政区|特別行政區|自治州|地区|地區|盟|市))/,
  );
  if (cityCn) return cityCn[1];

  const parts = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) return parts.slice(-2).join(", ");
  if (parts.length === 2) return parts.join(", ");
  return trimmed;
}
