import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { AuthShell } from '../components/auth/AuthShell';
import { useAuth } from '../hooks/AuthContext';
import { theme } from '../theme';

export function ProfileSetupPage() {
  const { completeProfile, user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await completeProfile(name.trim());
      // Navigation is handled automatically by RootNavigator when needsProfile becomes false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Almost there"
      subtitle="What should we call you?"
    >
      <View style={styles.form}>
        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="e.g. John Doe"
            placeholderTextColor={theme.colors.slate500}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            (loading || !name.trim()) && styles.buttonDisabled,
            pressed && !loading && !!name.trim() && styles.buttonPressed,
          ]}
          onPress={handleSubmit}
          disabled={loading || !name.trim()}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.textPrimary} />
          ) : (
            <>
              <Text style={styles.buttonText}>Complete Setup</Text>
              <ArrowRight color={theme.colors.textPrimary} size={18} />
            </>
          )}
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.slate300,
  },
  inputContainer: {
    backgroundColor: theme.colors.surfaceInput,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    height: '100%',
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.rose400,
    marginTop: -8,
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
});
