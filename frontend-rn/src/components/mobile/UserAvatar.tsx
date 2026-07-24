import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { theme } from '../../theme';

type UserAvatarSize = 'sm' | 'md' | 'lg';

const SIZES: Record<UserAvatarSize, { box: number; text: number }> = {
  sm: { box: 40, text: 14 },
  md: { box: 64, text: 18 },
  lg: { box: 80, text: 20 },
};

function initialsFromName(name?: string | null): string {
  if (!name?.trim()) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

type UserAvatarProps = {
  avatarUrl?: string | null;
  name?: string | null;
  size?: UserAvatarSize;
};

export function UserAvatar({ avatarUrl, name, size = 'md' }: UserAvatarProps) {
  const { box, text } = SIZES[size];

  if (avatarUrl?.trim()) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, { width: box, height: box, borderRadius: box / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: box, height: box, borderRadius: box / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: text }]}>
        {initialsFromName(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    flexShrink: 0,
    resizeMode: 'cover',
  },
  fallback: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.blue600,
  },
  initials: {
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
});
