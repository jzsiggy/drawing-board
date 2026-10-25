"use client";

import { useEffect } from "react";

// Next.js keeps a page alive, hidden, after you leave it (cacheComponents
// preserves routes with React <Activity>), so its state is still there when
// you come back. Effects do clean up when the page is hidden: run `reset`
// then. Pass a stable function (useCallback), or it runs on every render.
export function useResetOnLeave(reset: () => void) {
  useEffect(() => reset, [reset]);
}
