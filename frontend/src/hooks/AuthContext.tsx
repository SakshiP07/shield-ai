import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, clearToken, setToken, setUnauthorizedHandler, type User } from '../lib/api';
import {
  clearLocalPasskeyHints,
  createBiometricCredential,
  getBiometricAssertion,
  getLocalPasskeyIds,
  markBiometricRegisteredLocally,
} from '../lib/biometric';
import { isStoredTokenUsable, purgeInvalidStoredToken, clearGoogleOriginFailed } from '../lib/session';

export type { User };

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  needsProfile: boolean;
  sendOtp: (phone: string) => Promise<{ message: string; sms_sent: boolean; dev_otp?: string | null }>;
  verifyOtp: (phone: string, otp: string, intent?: 'login' | 'signup' | 'continue') => Promise<boolean>;
  googleLogin: (idToken: string, intent?: 'login' | 'signup' | 'continue') => Promise<boolean>;
  biometricLogin: () => Promise<boolean>;
  registerBiometric: (deviceLabel?: string) => Promise<void>;
  linkPhone: {
    sendOtp: (phone: string) => Promise<{ message: string; dev_otp?: string | null }>;
    verify: (phone: string, otp: string) => Promise<void>;
  };
  linkGoogle: (idToken: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  completeProfile: (name: string) => Promise<void>;
  updateProfile: (data: { name?: string; avatar_url?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setNeedsProfile(false);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let active = true;
    localStorage.removeItem('shieldpay_session');

    if (purgeInvalidStoredToken() || !isStoredTokenUsable()) {
      if (active) setLoading(false);
      return () => {
        active = false;
      };
    }

    api
      .restoreSession()
      .then((u) => {
        if (!active || !u) return;
        setUser(u);
        setNeedsProfile(!u.profile_completed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) throw new Error('Enter a valid 10-digit phone number');
    const res = await api.sendOtp(digits);
    return { message: res.message, sms_sent: res.sms_sent, dev_otp: res.dev_otp };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string, intent: 'login' | 'signup' | 'continue' = 'continue') => {
    const digits = phone.replace(/\D/g, '');
    const res = await api.verifyOtp(digits, otp, intent);
    setToken(res.access_token);
    setUser(res.user);
    setNeedsProfile(res.needs_profile);
    return res.needs_profile;
  }, []);

  const googleLogin = useCallback(async (idToken: string, intent: 'login' | 'signup' | 'continue' = 'continue') => {
    const res = await api.googleLogin(idToken, intent);
    clearGoogleOriginFailed();
    setToken(res.access_token);
    setUser(res.user);
    setNeedsProfile(res.needs_profile);
    return res.needs_profile;
  }, []);

  const biometricLogin = useCallback(async () => {
    const credentialIds = getLocalPasskeyIds();
    const options = await api.biometricLoginOptions(credentialIds);
    const sessionId = options.session_id;
    const { session_id: _sessionId, ...requestOptions } = options;
    const credential = await getBiometricAssertion(requestOptions);
    const res = await api.biometricLoginVerify(sessionId, credential);
    setToken(res.access_token);
    setUser(res.user);
    setNeedsProfile(res.needs_profile);
    return res.needs_profile;
  }, []);

  const registerBiometric = useCallback(async (deviceLabel?: string) => {
    const options = await api.biometricRegisterOptions();
    const credential = await createBiometricCredential(options);
    const result = await api.biometricRegisterVerify(credential, deviceLabel);
    markBiometricRegisteredLocally(true, result.credential_id);
  }, []);

  const linkPhone = useMemo(
    () => ({
      sendOtp: async (phone: string) => {
        const digits = phone.replace(/\D/g, '');
        const res = await api.linkPhoneSendOtp(digits);
        return { message: res.message, dev_otp: res.dev_otp };
      },
      verify: async (phone: string, otp: string) => {
        const digits = phone.replace(/\D/g, '');
        const updated = await api.linkPhoneVerify(digits, otp);
        setUser(updated);
      },
    }),
    [],
  );

  const linkGoogle = useCallback(async (idToken: string) => {
    const updated = await api.linkGoogle(idToken);
    setUser(updated);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await api.me();
    setUser(u);
    setNeedsProfile(!u.profile_completed);
  }, []);

  const completeProfile = useCallback(async (name: string) => {
    const updated = await api.updateProfile({ name });
    setUser(updated);
    setNeedsProfile(false);
  }, []);

  const updateProfile = useCallback(async (data: { name?: string; avatar_url?: string }) => {
    const updated = await api.updateProfile(data);
    setUser(updated);
    if (data.name) setNeedsProfile(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Local logout must still complete if the API is temporarily unreachable.
    }
    clearToken();
    clearLocalPasskeyHints();
    setUser(null);
    setNeedsProfile(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      needsProfile,
      sendOtp,
      verifyOtp,
      googleLogin,
      biometricLogin,
      registerBiometric,
      linkPhone,
      linkGoogle,
      refreshUser,
      completeProfile,
      updateProfile,
      signOut,
    }),
    [user, loading, needsProfile, sendOtp, verifyOtp, googleLogin, biometricLogin, registerBiometric, linkPhone, linkGoogle, refreshUser, completeProfile, updateProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
