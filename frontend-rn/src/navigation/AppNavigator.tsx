import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, ScanLine, MessageSquare, Bell, User } from 'lucide-react-native';

import { useAuth } from '../hooks/AuthContext';
import { AlertsSocketProvider } from '../hooks/AlertsSocketContext';
import { useAlertsSocket } from '../hooks/AlertsSocketContext';
import { theme } from '../theme';
import type { AndroidSmsInboxItem } from '../lib/api';

import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { ProfileSetupPage } from '../pages/ProfileSetupPage';
import { AppHomePage } from '../pages/app/AppHomePage';
import { ScanPage } from '../pages/app/ScanPage';
import { SmsPage } from '../pages/app/SmsPage';
import { SmsDetailPage } from '../pages/app/SmsDetailPage';
import { AlertsPage } from '../pages/app/AlertsPage';
import { AlertDetailPage } from '../pages/app/AlertDetailPage';
import { ProfilePage } from '../pages/app/ProfilePage';
import { ActivityPage } from '../pages/app/ActivityPage';
import { ScamAlertsPage } from '../pages/app/ScamAlertsPage';
import { BlockedScansPage } from '../pages/app/BlockedScansPage';
import { EditProfilePage } from '../pages/app/profile/EditProfilePage';
import { NotificationSettingsPage } from '../pages/app/profile/NotificationSettingsPage';
import { PrivacySettingsPage } from '../pages/app/profile/PrivacySettingsPage';
import { AiPreferencesPage } from '../pages/app/profile/AiPreferencesPage';
import { PlanPage } from '../pages/app/profile/PlanPage';

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  ProfileSetup: undefined;
  MainTabs: undefined;
  Activity: undefined;
  ScamAlerts: undefined;
  BlockedScans: undefined;
  EditProfile: undefined;
  NotificationSettings: undefined;
  PrivacySettings: undefined;
  AiPreferences: undefined;
  Plan: undefined;
  SmsDetail: { message: AndroidSmsInboxItem };
  AlertDetail: { alertId: string };
};

export type TabParamList = {
  Home: undefined;
  Scan: { tab?: string } | undefined;
  SMS: undefined;
  Alerts: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.blue500,
    background: theme.colors.bg,
    card: theme.colors.bg,
    text: theme.colors.textPrimary,
    border: theme.colors.border,
    notification: theme.colors.blue500,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: theme.colors.bg },
  headerTintColor: theme.colors.textPrimary,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 16 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.bg },
};

function AlertsTabIcon({ color, size }: { color: string; size: number }) {
  useAlertsSocket();
  return <Bell color={color} size={size} />;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);
  const tabBarHeight = 60 + bottomPad;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.bg },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderLight,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 8,
          paddingBottom: bottomPad,
          height: tabBarHeight,
          elevation: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarActiveTintColor: theme.colors.blue500,
        tabBarInactiveTintColor: theme.colors.slate500,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={AppHomePage}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanPage}
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, size }) => <ScanLine color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="SMS"
        component={SmsPage}
        options={{
          title: 'SMS',
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsPage}
        options={{
          title: 'Threats',
          tabBarIcon: ({ color, size }) => <AlertsTabIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfilePage}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

function MainTabsWithAlerts() {
  return (
    <AlertsSocketProvider>
      <MainTabs />
    </AlertsSocketProvider>
  );
}

function RootNavigator() {
  const { user, loading, needsProfile } = useAuth();

  if (loading) {
    return (
      <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
        <Stack.Screen name="Login" component={LoginPage} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginPage} />
          <Stack.Screen name="Signup" component={SignupPage} />
        </Stack.Group>
      ) : needsProfile ? (
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen name="ProfileSetup" component={ProfileSetupPage} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen
            name="MainTabs"
            component={MainTabsWithAlerts}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="Activity" component={ActivityPage} options={{ title: 'Recent Activity' }} />
          <Stack.Screen name="ScamAlerts" component={ScamAlertsPage} options={{ title: 'Scam Alerts' }} />
          <Stack.Screen name="BlockedScans" component={BlockedScansPage} options={{ title: 'Blocked Scans' }} />
          <Stack.Screen name="EditProfile" component={EditProfilePage} options={{ title: 'Edit Profile' }} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsPage} options={{ title: 'Notifications' }} />
          <Stack.Screen name="PrivacySettings" component={PrivacySettingsPage} options={{ title: 'Privacy Settings' }} />
          <Stack.Screen name="AiPreferences" component={AiPreferencesPage} options={{ title: 'AI Preferences' }} />
          <Stack.Screen name="Plan" component={PlanPage} options={{ title: 'Current Plan' }} />
          <Stack.Screen name="SmsDetail" component={SmsDetailPage} options={{ title: 'Message' }} />
          <Stack.Screen name="AlertDetail" component={AlertDetailPage} options={{ title: 'Alert Details' }} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}
