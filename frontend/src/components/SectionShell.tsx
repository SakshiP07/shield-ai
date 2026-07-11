import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from './shared';

interface SectionShellProps {
  id?: string;
  children: ReactNode;
  className?: string;
}

export function SectionShell({ id, children, className = '' }: SectionShellProps) {
  return (
    <section id={id} className={`relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28 ${className}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: SectionHeaderProps) {
  const alignClass = align === 'center' ? 'mx-auto text-center max-w-3xl' : 'max-w-2xl';

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={fadeUp}
      className={`mb-14 ${alignClass}`}
    >
      {eyebrow && (
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">{subtitle}</p>
      )}
    </motion.div>
  );
}
