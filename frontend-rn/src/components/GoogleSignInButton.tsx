import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../theme';

interface GoogleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function GoogleSignInButton({ onPress, disabled }: GoogleSignInButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path
          fill="#EA4335"
          d="M5.26498 14.2949L4.44917 17.3396L1.46415 17.4023C0.533256 15.6749 0 13.8824 0 12C0 10.2223 0.479549 8.52554 1.32832 6.88373L4.25055 7.41738L5.17833 10.1583C4.94939 10.7411 4.82367 11.3533 4.82367 12C4.82367 12.8021 4.98188 13.5707 5.26498 14.2949Z"
        />
        <Path
          fill="#34A853"
          d="M23.6351 9.53052C23.8647 10.3541 24 11.1683 24 12C24 13.0645 23.8058 14.0736 23.4287 15.0135C22.6146 17.065 21.1444 18.7905 19.2625 19.9868L16.0354 19.8213L15.5804 16.9698C16.8927 16.2081 17.9171 15.0116 18.5298 13.5414H12V9.53052H23.6351Z"
        />
        <Path
          fill="#4A90E2"
          d="M19.2625 19.9868C17.2624 21.2612 14.7725 22.0028 12 22.0028C7.14923 22.0028 2.97341 18.9105 1.46414 14.5447L5.26498 11.4373C6.38605 14.9351 9.71261 17.4691 13.7126 17.4691C14.5828 17.4691 15.4223 17.3075 16.2057 17.0118L19.2625 19.9868Z"
        />
        <Path
          fill="#FBBC05"
          d="M19.3879 3.86877L16.3312 6.84379C15.4851 6.38421 14.5682 6.13848 13.6264 6.13848C9.69176 6.13848 6.4259 8.57242 5.17833 11.9688L1.32833 8.86146C2.89066 4.5401 7.02511 1.48846 12 1.48846C14.7712 1.48846 17.2882 2.30232 19.3879 3.86877Z"
        />
      </Svg>
      <Text style={styles.text}>Continue with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    height: 48,
    borderRadius: 24,
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
});
