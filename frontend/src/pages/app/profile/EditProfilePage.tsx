import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileCard, MobilePage } from '../../../components/mobile/MobilePage';
import { UserAvatar } from '../../../components/mobile/UserAvatar';
import { useAuth } from '../../../hooks/AuthContext';
import { useToast } from '../../../hooks/ToastContext';

export function EditProfilePage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAvatarUrl(user.avatar_url ?? '');
    }
  }, [user]);

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(file);
      showToast('Photo uploaded', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
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
        <div className="mb-5 flex flex-col items-center gap-3">
          <UserAvatar avatarUrl={avatarUrl || null} name={name} size="lg" />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAvatarChange(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] font-medium text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload photo'}
          </button>
          <p className="text-center text-[12px] text-slate-500">Stored in your Supabase Storage bucket.</p>
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
          <span className="mb-1.5 block text-[13px] text-slate-500">Email</span>
          <input
            value={user?.email ?? 'Not set'}
            readOnly
            className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5 text-[15px] text-slate-400"
          />
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
            {user?.google_id ? 'Synced from Google.' : 'Link Google on your profile to add email.'}
          </p>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-slate-500">Phone</span>
          <input
            value={user?.phone ?? 'Not linked'}
            readOnly
            className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5 text-[15px] text-slate-400"
          />
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
            {user?.phone ? 'Verified phone on this account.' : 'Link a phone from the profile page if you want OTP login too.'}
          </p>
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
