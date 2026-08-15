export function humanBytes(bytes, decimals = 1) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / 1024 ** i;
  return `${val.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

export function seconds(s) {
  if (s == null) return '—';
  return `${Number(s).toFixed(s < 10 ? 1 : 0)} s`;
}

export function pct(n) {
  return `${Number(n || 0).toFixed(n % 1 === 0 ? 0 : 1)}%`;
}

export function classNames(...xs) {
  return xs.filter(Boolean).join(' ');
}
