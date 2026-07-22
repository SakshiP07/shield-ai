import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { User, Camera, ArrowRight, Loader2 } from 'lucide-react-native';
import { MobilePage, MobileCard } from '../../../components/mobile/MobilePage';
import { UserAvatar } from '../../../components/mobile/UserAvatar';
import { AccountLinkSection } from '../../../components/AccountLinkSection';
import { useAuth } from '../../../hooks/AuthContext';
import { useToast } from '../../../hooks/ToastContext';
import { theme } from '../../../theme';

export function EditProfilePage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation();
  
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      showToast('Profile updated', 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Camera roll permission needed to update avatar', 'error');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Ensure uri exists
        if (!asset.uri) return;

        setUploading(true);
        // Determine mime type and filename from uri
        const uriParts = asset.uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        const mimeType = fileType === 'png' ? 'image/png' : 'image/jpeg';
        
        await uploadAvatar({
          uri: asset.uri,
          name: asset.fileName || `avatar.${fileType}`,
          type: asset.mimeType || mimeType,
        });
        showToast('Avatar updated', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <MobilePage style={styles.page}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <Pressable onPress={handleAvatarChange} disabled={uploading}>
            <View style={styles.avatarContainer}>
              <UserAvatar avatarUrl={user.avatar_url} name={user.name} size="lg" />
              <View style={styles.avatarOverlay}>
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Camera color="#fff" size={20} />
                )}
              </View>
            </View>
          </Pressable>
          <Text style={styles.changePhotoText}>Tap to change photo</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>BASIC INFO</Text>
          <MobileCard padding="sm" style={styles.inputCard}>
            <View style={styles.inputRow}>
              <User color={theme.colors.slate400} size={20} style={styles.inputIcon} />
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your Name"
                  placeholderTextColor={theme.colors.slate500}
                />
              </View>
            </View>
          </MobileCard>
        </View>

        <AccountLinkSection user={user} />

        <Pressable
          onPress={handleSave}
          disabled={saving || !name.trim() || name.trim() === user.name}
          style={({ pressed }) => [
            styles.saveButton,
            (saving || !name.trim() || name.trim() === user.name) && styles.saveButtonDisabled,
            pressed && !saving && styles.saveButtonPressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.textPrimary} />
          ) : (
            <>
              <Text style={styles.saveButtonText}>Save Changes</Text>
              <ArrowRight color={theme.colors.textPrimary} size={18} />
            </>
          )}
        </Pressable>
      </ScrollView>
    </MobilePage>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    borderRadius: 40,
    overflow: 'hidden',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    marginTop: 12,
    fontSize: 13,
    color: theme.colors.blue400,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.slate500,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  inputCard: {
    paddingVertical: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 16,
  },
  inputContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: theme.colors.slate400,
    marginBottom: 2,
  },
  input: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    padding: 0,
    margin: 0,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.blue600,
    height: 52,
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 40,
  },
  saveButtonPressed: {
    backgroundColor: theme.colors.blue500,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
});
