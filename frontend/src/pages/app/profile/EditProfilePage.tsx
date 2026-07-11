import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileCard, MobilePage } from '../../../components/mobile/MobilePage';
import { UserAvatar } from '../../../components/mobile/UserAvatar';
import { useAuth } from '../../../hooks/AuthContext';
import { useToast } from '../../../hooks/ToastContext';

export function EditProfilePage() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAvatarUrl(user.avatar_url ?? '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        avatar_url: avatarUrl.trim() || undefined,
      });
      showToast('Profile updated', 'success');
      navigate('/app/profile');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobilePage>
      <MobileCard padding="lg" className="mb-4">
        <div className="mb-5 flex justify-center">
          <UserAvatar avatarUrl={avatarUrl || null} name={name} size="lg" />
        </div>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-slate-500">Full name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-[15px] text-white outline-none focus:border-blue-500/50"
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-slate-500">Profile picture URL</span>
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-[15px] text-white outline-none focus:border-blue-500/50"
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-slate-500">Email</span>
          <input
            value={user?.email ?? 'Not linked'}
            readOnly
            className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5 text-[15px] text-slate-400"
          />
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">Link Google on your profile to add or change email.</p>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-slate-500">Phone</span>
          <input
            value={user?.phone ?? 'Not linked'}
            readOnly
            className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5 text-[15px] text-slate-400"
          />
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">Link your phone from the profile page.</p>
        </label>
      </MobileCard>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="btn-primary disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save changes'}
      </button>
    </MobilePage>
  );
}
