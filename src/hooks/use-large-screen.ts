"use client";

import * as React from "react";

/** Matches Tailwind `lg:` — workbench chat visibility breakpoint. */
export const LARGE_SCREEN_MIN_PX = 1024;

export function useIsLargeScreen() {
  const [isLarge, setIsLarge] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LARGE_SCREEN_MIN_PX}px)`);
    const onChange = () => {
      setIsLarge(window.innerWidth >= LARGE_SCREEN_MIN_PX);
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isLarge ?? false;
}
