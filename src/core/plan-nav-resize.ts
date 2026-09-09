export const PLAN_NAV_MIN_W = 27;
export const PLAN_NAV_MIN_H = 45;
export const PLAN_NAV_MAX_W = 40;
export const PLAN_NAV_MAX_H = 64;

/** Top-left grip on a bottom-right anchored panel: drag out (left/up) grows. */
export function nextPanelSizeRem(input: {
  startW: number;
  startH: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  rootPx: number;
}): { w: number; h: number } {
  const root = input.rootPx > 0 ? input.rootPx : 16;
  const dw = (input.startX - input.clientX) / root;
  const dh = (input.startY - input.clientY) / root;
  return {
    w: Math.min(PLAN_NAV_MAX_W, Math.max(PLAN_NAV_MIN_W, input.startW + dw)),
    h: Math.min(PLAN_NAV_MAX_H, Math.max(PLAN_NAV_MIN_H, input.startH + dh)),
  };
}
