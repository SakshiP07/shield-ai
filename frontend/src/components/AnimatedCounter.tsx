import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

interface ParsedValue {
  prefix: string;
  num: number;
  suffix: string;
  decimals: number;
}

function parseValue(raw: string): ParsedValue {
  const match = String(raw).match(/^([^0-9]*)([\d.]+)(.*)$/);
  if (!match) return { prefix: '', num: 0, suffix: raw, decimals: 0 };
  const decimals = match[2].includes('.') ? match[2].split('.')[1].length : 0;
  return {
    prefix: match[1] || '',
    num: parseFloat(match[2]),
    suffix: match[3] || '',
    decimals,
  };
}

interface AnimatedCounterProps {
  value: string;
  duration?: number;
}

export function AnimatedCounter({ value, duration = 2 }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const { prefix, num, suffix, decimals } = parseValue(value);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView || num === 0) return undefined;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(num * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, num, duration]);

  const formatted =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();

  return (
    <motion.span ref={ref} className="tabular-nums">
      {prefix}
      {formatted}
      {suffix}
    </motion.span>
  );
}
