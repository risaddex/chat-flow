export function fmtTime(d: string | null) {
  if (!d) return 'Never';
  const dt = new Date(d);
  return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtCaseDate(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  if (diffDays < 7) return `${diffDays}D AGO`;
  return dt.toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase();
}
