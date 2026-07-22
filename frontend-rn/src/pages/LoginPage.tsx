import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthShell } from '../components/auth/AuthShell';
import { PhoneOtpAuth } from '../components/auth/PhoneOtpAuth';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/ToastContext';
import { startGoogleOAuth, takeOAuthIntent } from '../lib/googleRedirect';
import { theme } from '../theme';

export function LoginPage() {
  const { sendOtp, verifyOtp, googleLogin, user } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation();

  // If already logged in, the navigator will unmount this screen,
  // but just in case, we don't render the form if user is present.
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
      // In development mode (when OTP_DELIVERY=console), the backend returns the OTP
      if (res.dev_otp) {
        showToast(`DEV MODE: Your OTP is ${res.dev_otp}`, 'success');
      } else {
        showToast(res.message, 'success');
      }
    } catch (err) {
      throw err; // Let the PhoneOtpAuth component handle and display the error
    }
  };

  const handleVerifyOtp = async (phone: string, otp: string) => {
    try {
      // Intent 'continue' works for both login and auto-signup
      await verifyOtp(phone, otp, 'continue');
      showToast('Signed in successfully', 'success');
      // Navigation is handled automatically by RootNavigator based on `user` state
    } catch (err) {
      throw err;
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const accessToken = await startGoogleOAuth('login');
      if (!accessToken) return; // User cancelled
      await googleLogin(accessToken);
      showToast('Signed in with Google', 'success');
      // Navigation handled by RootNavigator
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google sign-in failed', 'error');
    }
  };

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

      <GoogleSignInButton onPress={handleGoogleSignIn} />
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
