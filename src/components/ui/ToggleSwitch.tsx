import * as React from "react"
import { cn } from "../../lib/utils"

interface ToggleSwitchProps {
    className?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
}

const ToggleSwitch = React.forwardRef<HTMLButtonElement, ToggleSwitchProps>(
    ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange?.(!checked)}
            ref={ref}
            className={cn(
                "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
                checked ? "bg-orange-500" : "bg-zinc-200 dark:bg-zinc-700",
                className
            )}
            {...props}
        >
            <span
                className={cn(
                    "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 bg-white",
                    checked ? "translate-x-5" : "translate-x-0"
                )}
            />
        </button>
    )
)
ToggleSwitch.displayName = "ToggleSwitch"

export { ToggleSwitch }
