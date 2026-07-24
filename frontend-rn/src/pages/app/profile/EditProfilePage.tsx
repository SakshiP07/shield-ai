import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { User, Camera, Phone, Mail, Pencil } from 'lucide-react-native';
import { MobilePage, MobileCard } from '../../../components/mobile/MobilePage';
import { UserAvatar } from '../../../components/mobile/UserAvatar';
import { useAuth } from '../../../hooks/AuthContext';
import { useToast } from '../../../hooks/ToastContext';
import { theme } from '../../../theme';

export function EditProfilePage() {
  const { user, updateProfile, uploadAvatar, linkPhone, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [phoneDraft, setPhoneDraft] = useState(user?.phone || '');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setPhoneDraft(user?.phone || '');
  }, [user?.name, user?.phone]);

  if (!user) return null;

  const dirtyName = name.trim() !== (user.name || '').trim();

  const cancelEditing = () => {
    setEditing(false);
    setName(user.name || '');
    setPhoneDraft(user.phone || '');
    setOtp('');
    setOtpSent(false);
  };

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      showToast('Name must be at least 2 characters', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      await refreshUser();
      showToast('Saved to your account', 'success');
      setEditing(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async () => {
    if (!editing) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Photo permission needed', 'error');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        setUploading(true);
        const uriParts = asset.uri.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        await uploadAvatar({
          uri: asset.uri,
          name: asset.fileName || `avatar.${fileType}`,
          type: asset.mimeType || (fileType === 'png' ? 'image/png' : 'image/jpeg'),
        });
        await refreshUser();
        showToast('Photo saved', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const sendPhoneOtp = async () => {
    const digits = phoneDraft.replace(/\D/g, '');
    if (digits.length < 10) {
      showToast('Enter a valid phone number', 'error');
      return;
    }
    setPhoneBusy(true);
    try {
      const res = await linkPhone.sendOtp(digits);
      setOtpSent(true);
      if (res.dev_otp) showToast(`DEV OTP: ${res.dev_otp}`, 'info');
      else showToast(res.message || 'OTP sent', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send OTP', 'error');
    } finally {
      setPhoneBusy(false);
    }
  };

  const verifyPhoneOtp = async () => {
    const digits = phoneDraft.replace(/\D/g, '');
    if (otp.trim().length < 4) {
      showToast('Enter the OTP', 'error');
      return;
    }
    setPhoneBusy(true);
    try {
      await linkPhone.verify(digits, otp.trim());
      await refreshUser();
      setOtp('');
      setOtpSent(false);
      showToast('Phone saved', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'OTP verification failed', 'error');
    } finally {
      setPhoneBusy(false);
    }
  };

  return (
    <MobilePage style={styles.page}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Text style={styles.topHint}>{editing ? 'Editing profile' : 'View profile'}</Text>
          {editing ? (
            <Pressable onPress={cancelEditing} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.editIconBtn}
              onPress={() => setEditing(true)}
              hitSlop={8}
              accessibilityLabel="Edit profile"
            >
              <Pencil color={theme.colors.blue400} size={18} />
            </Pressable>
          )}
        </View>

        <View style={styles.avatarSection}>
          <Pressable onPress={handleAvatarChange} disabled={!editing || uploading}>
            <View style={styles.avatarContainer}>
              <UserAvatar avatarUrl={user.avatar_url} name={user.name} size="lg" />
              {editing ? (
                <View style={styles.avatarOverlay}>
                  {uploading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Camera color="#fff" size={20} />
                  )}
                </View>
              ) : null}
            </View>
          </Pressable>
          <Text style={styles.changePhotoText}>
            {editing ? 'Tap photo to change' : 'Tap the pencil to edit'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>YOUR DETAILS</Text>
        <MobileCard padding="sm" style={styles.card}>
          <View style={styles.inputRow}>
            <User color={theme.colors.slate400} size={20} />
            <View style={styles.inputContent}>
              <Text style={styles.inputLabel}>Full name</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={theme.colors.slate500}
                  autoCapitalize="words"
                />
              ) : (
                <Text style={styles.readonly}>{user.name || '—'}</Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.inputRow}>
            <Mail color={theme.colors.slate400} size={20} />
            <View style={styles.inputContent}>
              <Text style={styles.inputLabel}>Email</Text>
              <Text style={styles.readonly}>{user.email || 'Not linked (sign in with Google)'}</Text>
            </View>
          </View>
        </MobileCard>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>PHONE</Text>
        <MobileCard padding="sm" style={styles.card}>
          <View style={styles.inputRow}>
            <Phone color={theme.colors.slate400} size={20} />
            <View style={styles.inputContent}>
              <Text style={styles.inputLabel}>
                {editing
                  ? user.phone
                    ? 'Update phone number'
                    : 'Add phone number'
                  : 'Phone number'}
              </Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={phoneDraft}
                  onChangeText={setPhoneDraft}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={theme.colors.slate500}
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.readonly}>{user.phone || 'Not linked'}</Text>
              )}
            </View>
          </View>

          {editing && otpSent ? (
            <>
              <View style={styles.divider} />
              <View style={styles.inputRow}>
                <View style={styles.inputContent}>
                  <Text style={styles.inputLabel}>OTP</Text>
                  <TextInput
                    style={styles.input}
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="6-digit code"
                    placeholderTextColor={theme.colors.slate500}
                    keyboardType="number-pad"
                    maxLength={8}
                  />
                </View>
              </View>
            </>
          ) : null}

          {editing ? (
            <>
              <Pressable
                style={[styles.secondaryBtn, phoneBusy && styles.disabled]}
                disabled={phoneBusy}
                onPress={() => void (otpSent ? verifyPhoneOtp() : sendPhoneOtp())}
              >
                {phoneBusy ? (
                  <ActivityIndicator color={theme.colors.blue400} />
                ) : (
                  <Text style={styles.secondaryBtnText}>
                    {otpSent
                      ? 'Verify & save phone'
                      : user.phone
                        ? 'Send OTP to update'
                        : 'Send OTP to link'}
                  </Text>
                )}
              </Pressable>
              <Text style={styles.hint}>OTP is sent by Twilio SMS to confirm ownership.</Text>
            </>
          ) : null}
        </MobileCard>

        {editing ? (
          <Pressable
            onPress={handleSave}
            disabled={saving || !dirtyName || name.trim().length < 2}
            style={({ pressed }) => [
              styles.saveButton,
              (saving || !dirtyName || name.trim().length < 2) && styles.saveButtonDisabled,
              pressed && !saving && styles.saveButtonPressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save name to account</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 16 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topHint: { fontSize: 13, color: theme.colors.slate400, fontWeight: '600' },
  cancelText: { color: theme.colors.slate300, fontWeight: '600', fontSize: 14 },
  editIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarContainer: { position: 'relative', borderRadius: 40, overflow: 'hidden' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: { marginTop: 12, fontSize: 13, color: theme.colors.blue400, fontWeight: '600' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.slate500,
    marginBottom: 10,
    letterSpacing: 0.6,
  },
  card: { paddingVertical: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputContent: { flex: 1 },
  inputLabel: { fontSize: 12, color: theme.colors.slate400, marginBottom: 2 },
  input: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    padding: 0,
    margin: 0,
  },
  readonly: { fontSize: 15, color: theme.colors.slate300, marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
  secondaryBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.blueSoft,
  },
  secondaryBtnText: { color: theme.colors.blue400, fontWeight: '700', fontSize: 14 },
  hint: {
    marginHorizontal: 16,
    marginBottom: 12,
    fontSize: 12,
    color: theme.colors.slate500,
    lineHeight: 17,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.blue600,
    height: 52,
    borderRadius: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonPressed: { backgroundColor: theme.colors.blue500 },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  disabled: { opacity: 0.6 },
});
