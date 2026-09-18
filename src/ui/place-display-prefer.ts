/**
 * Prefer itinerary-slot display name over cross-script details overlay (ADR-052 D9).
 * List title must not flash when details return another writing system
 * (CJK→Latin or Latin→CJK). Same-script details may refine the title.
 */

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
const LATIN_LETTER = /[A-Za-z]/;

export function hasCjk(text: string | undefined | null): boolean {
  return typeof text === "string" && CJK.test(text);
}

export function isLatinOnly(text: string | undefined | null): boolean {
  if (typeof text !== "string" || !text.trim()) return false;
  return LATIN_LETTER.test(text) && !CJK.test(text);
}

function isCrossScript(a: string, b: string): boolean {
  return (hasCjk(a) && isLatinOnly(b)) || (isLatinOnly(a) && hasCjk(b));
}

/** Keep slot name when details name is a different writing system. */
export function preferSlotDisplayName(
  slotName: string,
  detailsName?: string | null,
): string {
  if (!detailsName?.trim()) return slotName;
  if (isCrossScript(slotName, detailsName)) return slotName;
  return detailsName;
}

/** Keep slot address when details address is a different writing system. */
export function preferSlotDisplayAddress(
  slotAddress: string | undefined,
  detailsAddress?: string | null,
): string | undefined {
  if (!detailsAddress) return slotAddress;
  if (slotAddress && isCrossScript(slotAddress, detailsAddress)) {
    return slotAddress;
  }
  return detailsAddress;
}
