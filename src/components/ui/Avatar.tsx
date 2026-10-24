"use client";

import { useState } from "react";
import { cx } from "./cx";

/**
 * A GitHub avatar, or the name's initial on a circle when there is no image or it fails to load.
 * `className` sets the size; `initialClassName` sets the size of the fallback letter.
 */
export function Avatar({
  src,
  name,
  className,
  initialClassName,
}: {
  src?: string;
  name: string;
  className: string;
  initialClassName?: string;
}) {
  // The URL that failed, not a yes/no flag, so a different URL later gets its own try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && src !== failedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        // An image that failed before React attached onError never fires it, so check once mounted.
        ref={(img) => {
          if (img?.complete && img.naturalWidth === 0) setFailedSrc(src);
        }}
        onError={() => setFailedSrc(src)}
        className={cx("rounded-full border border-border object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex items-center justify-center rounded-full border border-border bg-surface-hover text-text-secondary",
        initialClassName,
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
