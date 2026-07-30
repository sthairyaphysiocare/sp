import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Official WhatsApp brand palette.
 *
 * Kept in one place so every WhatsApp touchpoint uses the real brand colours
 * rather than an approximation. WA_GREEN is the primary brand green; the darker
 * teal-green is what WhatsApp uses for hover / pressed states.
 */
export const WA_GREEN = "#25D366";
export const WA_GREEN_DARK = "#128C7E";

/**
 * WhatsApp glyph.
 *
 * Sizing is applied as CSS width/height plus `shrink-0`, not as bare width /
 * height attributes. Presentation attributes do not stop a flex item being
 * compressed, and an SVG with a viewBox has no intrinsic minimum width, so in a
 * tight flex row the glyph was squeezed down to a few pixels. That is why it
 * appeared as a dot next to a label that cannot wrap, such as "WhatsApp":
 * measured at 11.5px instead of 16px in a reproduction of the tab row.
 */
export function WhatsAppIcon({
  size = 16,
  className,
  style,
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={cn("shrink-0", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39-.16 0-.355-.085-.532-.184-1.825-.91-3.434-2.36-4.595-4.075-.144-.225-.495-.78-.495-1.04 0-.422.917-.694.917-1.135 0-.103-.027-.21-.072-.298-.108-.213-.65-1.484-.832-1.86-.243-.51-.495-.526-.83-.526-.116 0-.244-.005-.372-.005a.717.717 0 0 0-.522.244c-.448.484-.853 1.07-.853 1.892 0 .865.404 1.71.964 2.43a17.057 17.057 0 0 0 5.78 5.31c1.222.66 2.633 1.243 4.005 1.243 1.27 0 2.722-1.058 3.116-2.236.116-.358.166-.747.166-1.142 0-.18-.046-.342-.18-.443-.276-.21-1.732-.93-2.083-.93zM16 4C9.382 4 4 9.382 4 16c0 2.18.585 4.28 1.694 6.114L4 28l5.998-1.673A11.946 11.946 0 0 0 16 28c6.618 0 12-5.382 12-12S22.618 4 16 4zm0 22a10.16 10.16 0 0 1-5.34-1.523l-.387-.235-3.55.99.95-3.467-.252-.4A9.997 9.997 0 1 1 26 16c0 5.514-4.486 10-10 10z" />
    </svg>
  );
}
