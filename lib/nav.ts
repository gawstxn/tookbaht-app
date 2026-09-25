"use client";

import { useRouter } from "next/navigation";

/*
 * Going back through history (router.back) isn't a React transition, so the
 * page slide never ran for close / back buttons that pop the stack. goBack
 * wraps it in a view transition itself and waits for the previous page to
 * commit (PageTransition calls notifyPathCommitted) before the slide starts.
 */

let manualBack = false;
let committed: (() => void) | null = null;

/** Called by PageTransition after a route change has been committed to the DOM. */
export function notifyPathCommitted() {
  committed?.();
  committed = null;
}

/** True while goBack's own transition is running (PageTransition marks it as a pop). */
export function isManualBack() {
  return manualBack;
}

/** Back one step with the slide-back animation; `fallback` when there is no history (opened from a link). */
export function useGoBack(fallback: string) {
  const router = useRouter();
  return () => {
    const go = () => (window.history.length > 1 ? router.back() : router.replace(fallback));
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return go();
    manualBack = true;
    const vt = document.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          const done = () => resolve();
          committed = done;
          // Never hold the page frozen if the route somehow doesn't change.
          setTimeout(done, 800);
          go();
        }),
    );
    void vt.finished.finally(() => {
      manualBack = false;
    });
  };
}
