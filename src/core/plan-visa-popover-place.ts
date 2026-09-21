/** ~12rem. Flip upward only when the space below the link is shorter than this and above is larger. */
export const VISA_POPOVER_MIN_BELOW_PX = 192;
export const VISA_POPOVER_VIEWPORT_MARGIN_PX = 12;

export type VisaPopoverPlacement = {
  side: "below" | "above";
  maxHeightPx: number;
};

/**
 * Open the visa layer under the link unless the remaining viewport below is too short.
 * maxHeight is the leftover space so the box cannot leave the viewport.
 */
export function visaPopoverPlacement(input: {
  anchorTop: number;
  anchorBottom: number;
  viewportHeight: number;
  margin?: number;
  minBelow?: number;
}): VisaPopoverPlacement {
  const margin = input.margin ?? VISA_POPOVER_VIEWPORT_MARGIN_PX;
  const minBelow = input.minBelow ?? VISA_POPOVER_MIN_BELOW_PX;
  const below = input.viewportHeight - input.anchorBottom - margin;
  const above = input.anchorTop - margin;
  const side: VisaPopoverPlacement["side"] =
    below < minBelow && above > below ? "above" : "below";
  const space = side === "below" ? below : above;
  return { side, maxHeightPx: Math.max(0, Math.floor(space)) };
}
