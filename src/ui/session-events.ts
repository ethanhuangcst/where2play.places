export function notifySessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("where2play:session-changed"));
}
