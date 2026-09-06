/**
 * Prefer itinerary-slot CJK display over Latin Google details overlay (ADR-052 D9).
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

/** Keep slot name when it is CJK and details name is Latin-only. */
export function preferSlotDisplayName(
  slotName: string,
  detailsName?: string | null,
): string {
  if (detailsName && !(hasCjk(slotName) && isLatinOnly(detailsName))) {
    return detailsName;
  }
  return slotName;
}

/** Keep slot address when it is CJK and details address is Latin-only. */
export function preferSlotDisplayAddress(
  slotAddress: string | undefined,
  detailsAddress?: string | null,
): string | undefined {
  if (!detailsAddress) return slotAddress;
  if (slotAddress && hasCjk(slotAddress) && isLatinOnly(detailsAddress)) {
    return slotAddress;
  }
  return detailsAddress;
}
