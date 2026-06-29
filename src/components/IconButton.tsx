import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string;
  children: ReactNode;
}

/**
 * Icon-only button that always carries a tooltip on hover/focus.
 * Touch-friendly minimum size (44x44 css px), accessible aria-label.
 */
export function IconButton({ tooltip, children, className, ...rest }: Props) {
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={tooltip}
            {...rest}
            className={cn(
              "inline-flex items-center justify-center h-9 w-9 sm:h-9 sm:w-9 rounded-md text-foreground/70 hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none",
              className,
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
