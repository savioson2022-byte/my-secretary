export function getPersistentAlarmOffsets(
  repeatCount: number,
  intervalMinutes: number
) {
  const count = Math.max(1, Math.min(10, repeatCount));
  const interval = Math.max(1, Math.min(10, intervalMinutes));

  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return 0;
    return (index * 2 - 1) * interval;
  });
}
