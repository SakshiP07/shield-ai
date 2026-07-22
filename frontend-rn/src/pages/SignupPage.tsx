import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AuthShell } from '../components/auth/AuthShell';
import { PhoneOtpAuth } from '../components/auth/PhoneOtpAuth';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/ToastContext';
import { startGoogleOAuth } from '../lib/googleRedirect';
import { theme } from '../theme';

export function SignupPage() {
  const { sendOtp, verifyOtp, googleLogin, user } = useAuth();
  const { showToast } = useToast();

  if (user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.blue500} />
      </View>
    );
  }

  const handleSendOtp = async (phone: string) => {
    try {
      const res = await sendOtp(phone);
      showToast(res.message, 'success');
    } catch (err) {
      throw err;
    }
  };

  const handleVerifyOtp = async (phone: string, otp: string) => {
    try {
      await verifyOtp(phone, otp, 'signup');
      showToast('Account created successfully', 'success');
    } catch (err) {
      throw err;
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      const accessToken = await startGoogleOAuth('signup');
      if (!accessToken) return;
      await googleLogin(accessToken);
      showToast('Account created with Google', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google sign-up failed', 'error');
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Join ShieldAI to protect your devices"
      altText="Already have an account?"
      altLinkText="Sign in"
      altTo="Login"
    >
      <PhoneOtpAuth onSendOtp={handleSendOtp} onVerifyOtp={handleVerifyOtp} />
      
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.line} />
      </View>

      <GoogleSignInButton onPress={handleGoogleSignUp} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
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
});
