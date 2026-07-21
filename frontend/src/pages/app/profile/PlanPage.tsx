import { MobileCard, MobilePage } from '../../../components/mobile/MobilePage';
import { useAuth } from '../../../hooks/AuthContext';
import { Star } from 'lucide-react';

export function PlanPage() {
  const { user } = useAuth();
  const plan = user?.plan ?? 'Free Shield';

  return (
    <MobilePage>
      <MobileCard padding="lg" className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/15">
          <Star className="h-7 w-7 fill-blue-400 text-blue-400" />
        </div>
        <h2 className="text-[22px] font-bold text-white">{plan}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-400">Your active ShieldAI protection plan</p>
      </MobileCard>
      <MobileCard padding="sm" className="mt-4 space-y-2 text-[15px] text-slate-300">
        <p>Included with {plan}:</p>
        <ul className="list-inside list-disc space-y-1.5 text-[14px] text-slate-400">
          <li>AI-powered QR, SMS, UPI, and link scanning</li>
          <li>Real-time fraud alerts</li>
          <li>Behaviour and rule engine analysis</li>
          <li>Phone OTP sign-in</li>
        </ul>
      </MobileCard>
    </MobilePage>
  );
}
