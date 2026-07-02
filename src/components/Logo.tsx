import { LOGO_URL, CLINIC } from "@/lib/logo";
import { cn } from "@/lib/utils";

export function Logo({
  size = 40,
  showText = true,
  className,
  textClassName,
}: {
  size?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={LOGO_URL}
        alt={`${CLINIC.name} logo`}
        width={size}
        height={size}
        className="rounded-full object-cover ring-2 ring-brand/20 shrink-0"
        style={{ width: size, height: size }}
      />
      {showText && (
        <div className={cn("leading-tight", textClassName)}>
          <div className="font-display font-bold tracking-tight text-lg sm:text-xl text-brand-gradient">
            STHAIRYA
          </div>
          <div className="font-display font-semibold text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-brand">
            Physiocare
          </div>
          <div className="text-[8px] sm:text-[9px] font-medium tracking-[0.14em] opacity-70 mt-0.5 whitespace-nowrap">
            {CLINIC.tagline}
          </div>
        </div>
      )}
    </div>
  );
}
