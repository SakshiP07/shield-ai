import React from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, ScrollView } from 'react-native';
import { Shield } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  altText?: string;
  altLinkText?: string;
  altTo?: string; // route name e.g. 'Login' or 'Signup'
}

export function AuthShell({
  title,
  subtitle,
  children,
  altText,
  altLinkText,
  altTo,
}: AuthShellProps) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Shield color={theme.colors.blue500} size={32} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.formContainer}>{children}</View>

          {altText && altLinkText && altTo && (
            <View style={styles.footer}>
              <Text style={styles.altText}>{altText} </Text>
              <Pressable onPress={() => navigation.navigate(altTo)} hitSlop={8}>
                <Text style={styles.altLinkText}>{altLinkText}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.slate400,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  altText: {
    fontSize: 15,
    color: theme.colors.slate400,
  },
  altLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.blue400,
  },
});
