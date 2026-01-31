import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../../lib/utils";
import React from "react";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
    children?: React.ReactNode;
    variant?: "default" | "dark" | "accent";
    hoverEffect?: boolean;
}

export const GlassCard = ({
    children,
    className,
    variant = "default",
    hoverEffect = false,
    ...props
}: GlassCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300",

                // Variants
                variant === "default" && "bg-white/10 border-white/20 shadow-lg text-white",
                variant === "dark" && "bg-black/40 border-white/10 shadow-xl text-white",
                variant === "accent" && "bg-brand-green/20 border-brand-green/30 shadow-lg shadow-brand-green/10 text-white",

                // Hover Effect
                hoverEffect && "hover:bg-white/15 hover:scale-[1.01] hover:shadow-2xl hover:border-white/30 cursor-pointer",

                className
            )}
            {...props}
        >
            {/* Glossy Gradient Overlay */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white/5 to-transparent opacity-50 pointer-events-none" />

            {children}
        </motion.div>
    );
};
