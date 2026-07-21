import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MobileFrame } from '../mobile/MobileFrame';

type AuthShellProps = {
  title: string;
  subtitle?: string;
  footer?: { text: string; linkText: string; linkTo: string };
  children: ReactNode;
};

export function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
  return (
    <MobileFrame>
      <div className="mobile-scroll safe-area-top min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full flex-col px-5 pb-8 pt-6 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-icon">
              <Shield className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
            <span className="text-xl font-bold text-white">ShieldAI</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p> : null}
          </motion.div>

          <div className="flex-1">{children}</div>

          {footer && (
            <p className="mt-8 text-center text-sm text-slate-500">
              {footer.text}{' '}
              <Link to={footer.linkTo} className="font-medium text-blue-400 hover:text-blue-300">
                {footer.linkText}
              </Link>
            </p>
          )}
        </div>
      </div>
    </MobileFrame>
  );
}
