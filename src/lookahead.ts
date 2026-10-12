import { canonical } from './adapter';
/** Native queue order is authoritative, including when shuffle is active. */
export function upcomingTracks(root: ParentNode | null, current: string, count: number): string[] {
  if (!root || !current || count < 1) return [];
  const rows = [...root.querySelectorAll<HTMLElement>('.queueItemView')];
  const active = rows.find(row => row.classList.contains('m-active') && canonical(row.querySelector('.queueItemView__title a')?.getAttribute('href')) === current);
  if (!active) return [];
  const position = (row: HTMLElement): number => {
    const rect = row.getBoundingClientRect(); if (rect.height > 0) return rect.top;
    const wrapper = row.closest<HTMLElement>('.queue__itemWrapper') || row;
    const top = wrapper.style.top;
    if (top && Number.isFinite(parseFloat(top))) return parseFloat(top);
    const translate = wrapper.style.transform.match(/translateY\(\s*(-?[\d.]+)px/) || wrapper.style.transform.match(/translate(?:3d)?\([^,]+,\s*(-?[\d.]+)px/);
    return translate ? Number(translate[1]) : rows.indexOf(row);
  };
  const at = position(active);
  const next = rows.filter(row => row !== active && !row.classList.contains('m-dimmed') && position(row) > at).sort((a,b)=>position(a)-position(b)).slice(0, Math.min(3, count));
  return [...new Set(next.map(row=>canonical(row.querySelector('.queueItemView__title a')?.getAttribute('href'))).filter(key=>key && key !== current && /^\/[^/]+\/[^/]+$/.test(key)))];
}
