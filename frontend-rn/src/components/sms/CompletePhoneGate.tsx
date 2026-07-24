import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { MobileCard, MobilePage } from '../mobile/MobilePage';
import { useAuth } from '../../hooks/AuthContext';
import { ApiError } from '../../lib/api';
import { theme } from '../../theme';
import { SmsSyncService } from '../../sms/SmsSyncService';
import { SmsAuditEvent } from '../../sms/auditEvents';

type Props = {
  onCompleted: () => void;
};

export function CompletePhoneGate({ onCompleted }: Props) {
  const { linkPhone } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onContinue = async () => {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await linkPhone.sendOtp(digits);
      setDevOtp(res.dev_otp ?? null);
      setOtp('');
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    setError('');
    if (otp.length < 4) {
      setError('Enter the verification code');
      return;
    }
    setLoading(true);
    try {
      await linkPhone.verify(phone.replace(/\D/g, ''), otp);
      await SmsSyncService.audit(SmsAuditEvent.PROFILE_PHONE_UPDATED, 'Phone linked for SMS');
      onCompleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobilePage>
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>
        A verified phone number is required before using SMS. It will be saved to your existing
        account — no new signup.
      </Text>

      <MobileCard padding="md" style={styles.card}>
        {step === 'phone' ? (
          <>
            <View style={styles.phoneRow}>
              <View style={styles.cc}>
                <Text style={styles.ccText}>+91</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                placeholderTextColor={theme.colors.slate500}
                keyboardType="number-pad"
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                editable={!loading}
              />
            </View>
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              style={[styles.btn, (loading || phone.length < 10) && styles.btnDisabled]}
              disabled={loading || phone.length < 10}
              onPress={onContinue}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continue</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.otpHint}>
              Enter the OTP sent to <Text style={styles.otpPhone}>+91 {phone}</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="Enter OTP"
              placeholderTextColor={theme.colors.slate500}
              keyboardType="number-pad"
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              editable={!loading}
            />
            {!!devOtp && <Text style={styles.devOtp}>Dev OTP: {devOtp}</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              style={[styles.btn, (loading || otp.length < 4) && styles.btnDisabled]}
              disabled={loading || otp.length < 4}
              onPress={onVerify}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Verify & continue</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setStep('phone');
                setError('');
                setOtp('');
              }}
              disabled={loading}
            >
              <Text style={styles.back}>Change phone number</Text>
            </Pressable>
          </>
        )}
      </MobileCard>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: theme.colors.slate400,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    gap: 14,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceInput,
    overflow: 'hidden',
  },
  cc: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  ccText: {
    color: theme.colors.slate300,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    color: theme.colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceInput,
  },
  otpHint: {
    color: theme.colors.slate400,
    fontSize: 14,
  },
  otpPhone: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  devOtp: {
    color: theme.colors.slate500,
    fontSize: 12,
  },
  error: {
    color: theme.colors.rose400,
    fontSize: 13,
  },
  btn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  back: {
    textAlign: 'center',
    color: theme.colors.slate500,
    fontSize: 14,
    marginTop: 4,
  },
});
