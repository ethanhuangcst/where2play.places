/** Near-bottom sticky scroll for the assistant thread (chat transcript). */

export type ScrollBox = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
};

export const NEAR_THREAD_BOTTOM_PX = 72;

export function isNearScrollBottom(
  box: ScrollBox,
  thresholdPx: number = NEAR_THREAD_BOTTOM_PX,
): boolean {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= thresholdPx;
}

/** Scroll the thread body itself — never scrollIntoView (that can pin the page). */
export function stickThreadBodyToEnd(
  el: { scrollTop: number; scrollHeight: number } | null,
  shouldStick: boolean,
): void {
  if (!el || !shouldStick) return;
  el.scrollTop = el.scrollHeight;
}
