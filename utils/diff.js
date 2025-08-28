
export function computeDiff(before = {}, after = {}) {
  const diff = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of keys) {
    const b = before?.[key];
    const a = after?.[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[key] = { from: b, to: a };
    }
  }
  return diff;
}
