import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AuthShell } from '../components/auth/AuthShell';
import { PhoneOtpAuth } from '../components/auth/PhoneOtpAuth';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/ToastContext';
import { startGoogleOAuth } from '../lib/googleRedirect';
import { theme } from '../theme';

type GooglePhase = 'idle' | 'browser' | 'account';

export function LoginPage() {
  const { sendOtp, verifyOtp, googleLogin, user } = useAuth();
  const { showToast } = useToast();
  const [googlePhase, setGooglePhase] = useState<GooglePhase>('idle');
  const googleBusy = googlePhase !== 'idle';

  if (user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.blue500} />
        <Text style={styles.centerText}>Taking you in…</Text>
      </View>
    );
  }

  const handleSendOtp = async (phone: string) => {
    const res = await sendOtp(phone);
    if (res.dev_otp) {
      showToast(`DEV MODE: Your OTP is ${res.dev_otp}`, 'success');
    } else {
      showToast(res.message, 'success');
    }
  };

  const handleVerifyOtp = async (phone: string, otp: string) => {
    await verifyOtp(phone, otp, 'continue');
    showToast('Signed in successfully', 'success');
  };

  const handleGoogleSignIn = async () => {
    if (googleBusy) return;
    setGooglePhase('browser');
    try {
      const accessToken = await startGoogleOAuth('login');
      if (!accessToken) {
        showToast('Google sign-in was cancelled', 'info');
        return;
      }
      setGooglePhase('account');
      await googleLogin(accessToken);
      showToast('Signed in with Google', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google sign-in failed', 'error');
    } finally {
      setGooglePhase('idle');
    }
  };

  const googleLabel =
    googlePhase === 'browser'
      ? 'Opening Google…'
      : googlePhase === 'account'
        ? 'Signing you in…'
        : 'Continue with Google';

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your ShieldAI account"
      altText="Don't have an account?"
      altLinkText="Sign up"
      altTo="Signup"
    >
      <PhoneOtpAuth onSendOtp={handleSendOtp} onVerifyOtp={handleVerifyOtp} />

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.line} />
      </View>

      <GoogleSignInButton
        onPress={handleGoogleSignIn}
        disabled={googleBusy}
        loading={googleBusy}
        label={googleLabel}
      />
      {googleBusy ? (
        <Text style={styles.hint}>
          {googlePhase === 'browser' ? 'Pick your Google account' : 'Almost done — creating your session'}
        </Text>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
    gap: 12,
  },
  centerText: {
    color: theme.colors.slate400,
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.slate500,
  },
  hint: {
    marginTop: 12,
    textAlign: 'center',
    color: theme.colors.slate500,
    fontSize: 13,
  },
});
