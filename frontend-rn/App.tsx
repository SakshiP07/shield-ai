import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from './src/hooks/AuthContext';
import { ToastProvider } from './src/hooks/ToastContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initApiBase } from './src/lib/api';
import { theme } from './src/theme';

export default function App() {
  useEffect(() => {
    void initApiBase();
  }, []);

  return (
    <GestureHandlerRootView style={styles.appWrapper}>
      <SafeAreaProvider>
        <ToastProvider>
          <AuthProvider>
            <View style={styles.appWrapper}>
              <AppNavigator />
              <StatusBar style="light" />
            </View>
          </AuthProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appWrapper: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
});
