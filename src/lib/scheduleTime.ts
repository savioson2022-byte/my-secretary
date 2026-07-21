export function timeToMinutes(timeText: string) {
  const [hour = "0", minute = "0"] = timeText.split(":");
  return Number(hour) * 60 + Number(minute);
}

export function isOvernightTimeRange(startTime: string, endTime: string) {
  return timeToMinutes(endTime) < timeToMinutes(startTime);
}

export function getEndMinutesAfterStart(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return endMinutes < startMinutes ? endMinutes + 24 * 60 : endMinutes;
}
