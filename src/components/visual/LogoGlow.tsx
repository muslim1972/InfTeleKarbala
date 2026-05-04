import { motion } from 'framer-motion';

interface LogoGlowProps {
  src?: string;
  className?: string;
  glowColor?: string;
  glowSpread?: string;
  outlineColor?: string;
  outlineWidth?: string;
}

export const LogoGlow = ({
  src = "/logo-new.png",
  className = "max-w-[55vw] max-h-[40vh] md:max-h-[45vh] w-auto h-auto object-contain",
  glowColor = "rgba(255, 255, 255, 0.7)",
  glowSpread = "15px",
  outlineColor = "rgba(255, 255, 255, 0.95)",
  outlineWidth = "1px",
}: LogoGlowProps) => {
  return (
    <motion.img
      src={src}
      alt="ITPC Logo"
      className={className}
      initial={{ opacity: 0, scale: 1.35 }}
      animate={{
        opacity: 1,
        y: [0, -12, 0],
        filter: [
          `contrast(1.1) brightness(1.2) drop-shadow(0 0 ${outlineWidth} ${outlineColor}) drop-shadow(0 0 ${outlineWidth} ${outlineColor}) drop-shadow(0 0 ${glowSpread} ${glowColor}) drop-shadow(0 0 50px rgba(34,197,94,0.2))`,
          `contrast(1.2) brightness(1.3) drop-shadow(0 0 ${outlineWidth} ${outlineColor}) drop-shadow(0 0 ${outlineWidth} ${outlineColor}) drop-shadow(0 0 ${parseInt(glowSpread) * 1.5}px ${glowColor}) drop-shadow(0 0 80px rgba(34,197,94,0.4))`,
          `contrast(1.1) brightness(1.2) drop-shadow(0 0 ${outlineWidth} ${outlineColor}) drop-shadow(0 0 ${outlineWidth} ${outlineColor}) drop-shadow(0 0 ${glowSpread} ${glowColor}) drop-shadow(0 0 50px rgba(34,197,94,0.2))`,
        ],
      }}
      transition={{
        opacity: { delay: 3, duration: 2.5, ease: [0.16, 1, 0.3, 1] },
        y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
        filter: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
      }}
    />
  );
};
