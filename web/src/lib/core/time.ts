export const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const hour24 = Math.floor(i / 2);
  const minute = (i % 2) * 30;

  const value = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const name = value; // 24-hour clock: "00:00", "00:30", etc.

  return { name, value };
});

export function to12Hour(time24: string): string {
  if (!time24) return "";
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const h = parts[0].padStart(2, "0");
  const m = parts[1].slice(0, 2).padStart(2, "0");
  return `${h}:${m}`;
}