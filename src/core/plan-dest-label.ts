/**
 * Format destination verified label for takeoff (2play-plan-100 / ADR-061).
 * Domestic/overseas share `country/city`; append `(city_en)` when English differs.
 */
export function formatDestVerifiedLabel(input: {
  country?: string | null;
  city?: string | null;
  city_en?: string | null;
}): string | null {
  const country = input.country?.trim();
  const city = input.city?.trim();
  if (!country || !city) return null;
  const cityEn = input.city_en?.trim();
  if (cityEn && cityEn !== city) return `${country}/${city}(${cityEn})`;
  return `${country}/${city}`;
}
