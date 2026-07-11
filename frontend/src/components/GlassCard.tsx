import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function GlassCard({ children, className = '', glow = false }: GlassCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-glass backdrop-blur-xl transition-shadow duration-300 ${
        glow ? 'hover:border-blue-500/30 hover:shadow-glow-blue' : 'hover:border-white/15'
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}
