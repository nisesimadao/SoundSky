import type { Root } from 'react-dom/client';

/** Paper disposes GPU resources on unmount; also release the browser's context slot. */
export function unmountShader(root: Root | null, surface: HTMLElement) {
  if (!root) return;
  const contexts = [...surface.querySelectorAll('canvas')].map(canvas => canvas.getContext('webgl2'));
  root.unmount();
  for (const context of contexts) context?.getExtension('WEBGL_lose_context')?.loseContext();
}
