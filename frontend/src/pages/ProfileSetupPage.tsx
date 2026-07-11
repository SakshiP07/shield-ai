import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/ToastContext';
import { MobileFrame } from '../components/mobile/MobileFrame';

export function ProfileSetupPage() {
  const { user, loading: authLoading, completeProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <MobileFrame>
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </MobileFrame>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.profile_completed) return <Navigate to="/app" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setLoading(true);
    try {
      await completeProfile(name.trim());
      showToast(`Welcome, ${name.trim()}`, 'success');
      navigate('/app');
    } catch {
      showToast('Could not save your profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileFrame>
      <div className="mobile-scroll safe-area-top min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full flex-col px-5 pb-8 pt-6 sm:px-6">
          <h1 className="text-2xl font-bold text-white">Complete your profile</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">Add your name to finish setting up ShieldAI.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-surface-input px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={loading || name.trim().length < 2}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </MobileFrame>
  );
}
