import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/AuthContext';
import { ToastProvider } from './hooks/ToastContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ProfileSetupPage } from './pages/ProfileSetupPage';
import { AppHomePage } from './pages/app/AppHomePage';
import { ScanPage } from './pages/app/ScanPage';
import { SmsPage } from './pages/app/SmsPage';
import { AlertsPage } from './pages/app/AlertsPage';
import { ActivityPage } from './pages/app/ActivityPage';
import { ScamAlertsPage } from './pages/app/ScamAlertsPage';
import { BlockedScansPage } from './pages/app/BlockedScansPage';
import { EditProfilePage } from './pages/app/profile/EditProfilePage';
import { NotificationSettingsPage } from './pages/app/profile/NotificationSettingsPage';
import { PrivacySettingsPage } from './pages/app/profile/PrivacySettingsPage';
import { AiPreferencesPage } from './pages/app/profile/AiPreferencesPage';
import { PlanPage } from './pages/app/profile/PlanPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import { ProfilePage } from './pages/app/ProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
          <Route path="/setup" element={<ProfileSetupPage />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<AppHomePage />} />
            <Route path="scan" element={<ScanPage />} />
            <Route path="sms" element={<SmsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="scam-alerts" element={<ScamAlertsPage />} />
            <Route path="blocked-scans" element={<BlockedScansPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/edit" element={<EditProfilePage />} />
            <Route path="profile/notifications" element={<NotificationSettingsPage />} />
            <Route path="profile/privacy" element={<PrivacySettingsPage />} />
            <Route path="profile/ai" element={<AiPreferencesPage />} />
            <Route path="profile/plan" element={<PlanPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
