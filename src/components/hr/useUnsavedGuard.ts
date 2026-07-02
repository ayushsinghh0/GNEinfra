"use client";

import { useEffect } from "react";

/**
 * Shared unsaved-changes navigation guard for the module's biggest forms
 * (AttendanceGrid's paint grid, EmployeeForm's ~30-field record). Active
 * ONLY while `dirty` is true; both listeners are removed the moment `dirty`
 * flips back to false (saved/discarded) or the component unmounts.
 *
 * Two layers:
 * (1) `beforeunload` covers hard nav (typed URL, refresh, tab close) — the
 *     browser shows its own generic prompt, `returnValue` is legacy-required.
 * (2) A capture-phase `document` click listener covers in-app `<Link>`
 *     navigations (sidebar, breadcrumbs, month/record nav, …) that a
 *     server-rendered page can't see `dirty` to guard itself. It walks up to
 *     the nearest `<a href>`, skips new-tab/download/hash/external targets,
 *     and — for a same-origin navigation — shows a native `confirm()`.
 *     Declining calls `preventDefault()` in the CAPTURE phase, which runs
 *     before Next.js Link's own bubble-phase click handler; Link bails out
 *     when it sees `event.defaultPrevented`, so the router never navigates.
 *
 * Known gap: the browser Back/Forward buttons don't fire a click (or, for
 * client-side App Router transitions, `beforeunload`), so they aren't
 * covered — that would need a `popstate` handler with its own history
 * gymnastics, out of scope for this pragmatic guard. Programmatic
 * `router.push`/`router.back()` calls (e.g. a form's own Cancel button)
 * aren't covered either — callers should confirm those explicitly before
 * navigating (see EmployeeForm's Cancel handler).
 */
export function useUnsavedGuard(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }

    function onClickCapture(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return; // new tab/window — nothing lost here
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try { url = new URL(anchor.href); } catch { return; }
      if (url.origin !== window.location.origin) return; // external link — leaving the app anyway

      const ok = window.confirm(message);
      if (!ok) e.preventDefault();
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [dirty, message]);
}
