// Infinite horizontal marquee: duplicates its children once so the CSS
// animation can loop seamlessly from -50% back to 0.
import type { ReactNode } from "react";

type MarqueeProps = {
  children: ReactNode;
  className?: string;
};

export function Marquee({ children, className = "" }: MarqueeProps) {
  return (
    <div className={`marquee ${className}`}>
      <div className="marquee-track">
        <div className="flex shrink-0 items-center gap-10">{children}</div>
        <div className="flex shrink-0 items-center gap-10" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}
