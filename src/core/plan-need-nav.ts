export function redoNeedState<T extends string>(
  questions: Array<{ id: T }>,
  index: number,
  answers: Partial<Record<T, string>>,
): { index: number; answers: Partial<Record<T, string>> } {
  if (index <= 0) return { index, answers };
  const currentId = questions[index]?.id;
  const prevId = questions[index - 1]?.id;
  const next = { ...answers };
  if (currentId) delete next[currentId];
  if (prevId) delete next[prevId];
  return { index: index - 1, answers: next };
}
