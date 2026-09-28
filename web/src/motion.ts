import { flushSync } from 'react-dom';

/** Native, bounded layout continuity; reduced-motion users receive immediate updates. */
export function transitionInterface(update: () => void) {
  if (document.documentElement.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches || !document.startViewTransition) {
    update(); return;
  }
  document.startViewTransition(() => flushSync(update));
}
