import { motion } from 'framer-motion';

interface LogoGlowProps {
  src?: string;
  className?: string;
  glowColor?: string;
  glowSpread?: string;
  glowOpacity?: number;
}

export const LogoGlow = ({
  src = "/logo-new.png",
  className = "max-w-[55vw] max-h-[40vh] md:max-h-[45vh] w-auto h-auto object-contain",
  glowColor = "rgba(255, 255, 255, 0.8)", // التوهج الأبيض من Canva
  glowSpread = "12px", // زيادة قليلاً ليعطي تأثيراً أوضح
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
          `drop-shadow(0 0 ${glowSpread} ${glowColor}) drop-shadow(0 0 45px rgba(34,197,94,0.35))`,
          `drop-shadow(0 0 ${parseInt(glowSpread) * 1.5}px ${glowColor}) drop-shadow(0 0 75px rgba(34,197,94,0.55))`,
          `drop-shadow(0 0 ${glowSpread} ${glowColor}) drop-shadow(0 0 45px rgba(34,197,94,0.35))`,
        ],
      }}
      transition={{
        opacity: { delay: 7, duration: 2.8, ease: [0.16, 1, 0.3, 1] },
        y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
        filter: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
      }}
    />
  );
};
