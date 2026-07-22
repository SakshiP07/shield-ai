import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ScanLine, MessageSquare, Bell, User } from 'lucide-react-native';

import { useAuth } from '../hooks/AuthContext';
import { AlertsSocketProvider } from '../hooks/AlertsSocketContext';
import { useAlertsSocket } from '../hooks/AlertsSocketContext';
import { theme } from '../theme';

// Pages
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { ProfileSetupPage } from '../pages/ProfileSetupPage';
import { AppHomePage } from '../pages/app/AppHomePage';
import { ScanPage } from '../pages/app/ScanPage';
import { SmsPage } from '../pages/app/SmsPage';
import { AlertsPage } from '../pages/app/AlertsPage';
import { ProfilePage } from '../pages/app/ProfilePage';
import { ActivityPage } from '../pages/app/ActivityPage';
import { ScamAlertsPage } from '../pages/app/ScamAlertsPage';
import { BlockedScansPage } from '../pages/app/BlockedScansPage';
import { EditProfilePage } from '../pages/app/profile/EditProfilePage';
import { NotificationSettingsPage } from '../pages/app/profile/NotificationSettingsPage';
import { PrivacySettingsPage } from '../pages/app/profile/PrivacySettingsPage';
import { AiPreferencesPage } from '../pages/app/profile/AiPreferencesPage';
import { PlanPage } from '../pages/app/profile/PlanPage';

// ─── Type definitions ─────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  ProfileSetup: undefined;
  MainTabs: undefined;
  // Sub-screens pushed on top of tabs:
  Activity: undefined;
  ScamAlerts: undefined;
  BlockedScans: undefined;
  EditProfile: undefined;
  NotificationSettings: undefined;
  PrivacySettings: undefined;
  AiPreferences: undefined;
  Plan: undefined;
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

// ─── Shared header style ──────────────────────────────────────

const screenOptions = {
  headerStyle: { backgroundColor: theme.colors.bg },
  headerTintColor: theme.colors.textPrimary,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 16 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.bg },
};

// ─── Tab Navigator ────────────────────────────────────────────

function AlertsTabIcon({ color, size }: { color: string; size: number }) {
  const { unreadCount } = useAlertsSocket();
  return (
    <>
      <Bell color={color} size={size} />
      {/* Badge overlay would need absolute positioning — simplified for now */}
    </>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingTop: 4,
          height: 56,
        },
        tabBarActiveTintColor: theme.colors.blue500,
        tabBarInactiveTintColor: theme.colors.slate500,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' as const, fontSize: 16 },
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={AppHomePage}
        options={{
          title: 'ShieldAI',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanPage}
        options={{
          title: 'AI Scanner',
          tabBarIcon: ({ color, size }) => <ScanLine color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="SMS"
        component={SmsPage}
        options={{
          title: 'SMS Shield',
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsPage}
        options={{
          title: 'Alert Center',
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

// ─── Root Navigator ───────────────────────────────────────────

function RootNavigator() {
  const { user, loading, needsProfile } = useAuth();

  if (loading) {
    // The NavigationContainer needs a valid navigator even during loading.
    // We'll render a loading screen as the Login page handles showing the spinner.
    return (
      <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
        <Stack.Screen name="Login" component={LoginPage} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        // Not logged in
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginPage} />
          <Stack.Screen name="Signup" component={SignupPage} />
        </Stack.Group>
      ) : needsProfile ? (
        // Logged in but needs profile completion
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen name="ProfileSetup" component={ProfileSetupPage} />
        </Stack.Group>
      ) : (
        // Fully authenticated
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
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

// ─── App Navigator (wraps everything) ─────────────────────────

export function AppNavigator() {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}
