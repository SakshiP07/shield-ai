import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Phone, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react-native';
import { theme } from '../../theme';

interface PhoneOtpAuthProps {
  onSendOtp: (phone: string) => Promise<void>;
  onVerifyOtp: (phone: string, otp: string) => Promise<void>;
  loading?: boolean;
}

export function PhoneOtpAuth({ onSendOtp, onVerifyOtp, loading }: PhoneOtpAuthProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const handlePhoneSubmit = async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    setError('');
    try {
      await onSendOtp(phone);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    }
  };

  const handleOtpSubmit = async () => {
    if (otp.length < 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setError('');
    try {
      await onVerifyOtp(phone, otp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    }
  };

  return (
    <View style={styles.container}>
      {step === 'phone' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputContainer}>
            <Phone color={theme.colors.slate400} size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor={theme.colors.slate500}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (loading || !phone) && styles.buttonDisabled,
              pressed && !loading && !!phone && styles.buttonPressed,
            ]}
            onPress={handlePhoneSubmit}
            disabled={loading || !phone}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.textPrimary} />
            ) : (
              <>
                <Text style={styles.buttonText}>Send Code</Text>
                <ArrowRight color={theme.colors.textPrimary} size={18} />
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.otpHeader}>
            <Text style={styles.label}>Enter OTP</Text>
            <Pressable onPress={() => setStep('phone')} hitSlop={8}>
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          </View>
          
          <View style={styles.inputContainer}>
            <ShieldCheck color={theme.colors.slate400} size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor={theme.colors.slate500}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              editable={!loading}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (loading || otp.length < 6) && styles.buttonDisabled,
              pressed && !loading && otp.length === 6 && styles.buttonPressed,
            ]}
            onPress={handleOtpSubmit}
            disabled={loading || otp.length < 6}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.textPrimary} />
            ) : (
              <Text style={styles.buttonText}>Verify & Continue</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.resendButton,
              pressed && styles.resendButtonPressed,
            ]}
            onPress={handlePhoneSubmit}
            disabled={loading}
          >
            <RefreshCw color={theme.colors.slate400} size={14} />
            <Text style={styles.resendText}>Resend OTP</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.slate300,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceInput,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    height: '100%',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.blue600,
    height: 52,
    borderRadius: 16,
    marginTop: 8,
  },
  buttonPressed: {
    backgroundColor: theme.colors.blue500,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.rose400,
    marginTop: -8,
  },
  otpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 13,
    color: theme.colors.blue400,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  resendButtonPressed: {
    opacity: 0.7,
  },
  resendText: {
    fontSize: 14,
    color: theme.colors.slate400,
  },
});
