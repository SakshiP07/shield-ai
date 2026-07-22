import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MobileFrame } from '../mobile/MobileFrame';

type AuthShellProps = {
  title: string;
  subtitle?: string;
  footer?: { text: string; linkText: string; linkTo: string };
  children: ReactNode;
};

/** Compact ShieldAI mark — white outline shield, no fill / no tile */
function BrandMark() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
        <path
          d="M12 3.2 5 6.4v5.5c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V6.4L12 3.2Z"
          stroke="white"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
  return (
    <MobileFrame>
      <div className="mobile-scroll safe-area-top min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-sm flex-col px-6 pb-10 pt-7 sm:px-8 sm:py-9">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-7 flex items-center gap-3"
          >
            <BrandMark />
            <span className="text-[1.25rem] font-semibold tracking-tight text-white">ShieldAI</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-7"
          >
            <h1 className="text-[1.625rem] font-bold leading-tight tracking-tight text-white">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p> : null}
          </motion.div>

          <div className="flex-1">{children}</div>

          {footer && (
            <p className="mt-10 text-center text-sm text-slate-500">
              {footer.text}{' '}
              <Link
                to={footer.linkTo}
                className="font-medium text-blue-400 transition hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              >
                {footer.linkText}
              </Link>
            </p>
          )}
        </div>
      </div>
    </MobileFrame>
  );
}
