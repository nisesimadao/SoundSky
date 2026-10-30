import brand from './brand.json';
import soundcloud from './soundcloud-mark.json';

const paths: Record<string, string> = {
  queue: '<path d="M4 6h12M4 11h12M4 16h8m4-2 5 3-5 3Z"/>',
  shuffle: '<path d="M3 6h3c4 0 6 12 10 12h5m-4-4 4 4-4 4M3 18h3c2 0 3-3 4-5m3-2c1-3 2-5 4-5h4m-4-4 4 4-4 4"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  close: '<path d="m7 7 10 10M17 7 7 17"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  external: '<path d="M14 4h6v6m-1-5-9 9M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  previous: '<path d="M5 5v14m14-14L8 12l11 7Z" fill="currentColor"/>',
  next: '<path d="M19 5v14M5 5l11 7-11 7Z" fill="currentColor"/>',
  heart: '<path d="M20.4 4.6a5.3 5.3 0 0 0-7.5 0l-.9 1-.9-1a5.3 5.3 0 0 0-7.5 7.5L12 20l8.4-7.9a5.3 5.3 0 0 0 0-7.5Z"/>',
  repost: '<path d="m3 8 4-4 4 4M7 4v11a3 3 0 0 0 3 3h2m9-2-4 4-4-4m4 4V9a3 3 0 0 0-3-3h-2"/>',
  follow: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m3-11v6m-3-3h6"/>',
  volume: '<path d="M4 9h4l5-4v14l-5-4H4Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4Zm13 1 5 5m0-5-5 5"/>',
  music: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  tune: '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4M10 8h4M18 16h4"/>',
};
const brandIcon = [
  `<svg viewBox="0 0 ${brand.size} ${brand.size}" aria-hidden="true">`,
  `<path d="${brand.tile.d}" transform="${brand.tile.transform}" fill="${brand.background}"/>`,
  `<g fill="${brand.foreground}">`,
  ...brand.paths.map(path => `<path d="${path.d}" transform="${path.transform}"/>`),
  '</g></svg>',
].join('');

const soundcloudIcon = `<svg viewBox="${soundcloud.viewBox}" fill="currentColor" aria-hidden="true"><g transform="${soundcloud.transform}">${soundcloud.paths.map(d => `<path d="${d}"/>`).join('')}</g></svg>`;

export const icon = (name: string) => name === 'soundcloud' ? soundcloudIcon : name === 'sky' ? brandIcon : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.music}</svg>`;
