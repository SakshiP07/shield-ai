export type AppBarConfig = {
  title: string;
  showBack?: boolean;
  backTo?: string;
};

export function getAppBarConfig(pathname: string): AppBarConfig {
  if (pathname === '/app' || pathname === '/app/') {
    return { title: 'ShieldAI' };
  }
  if (pathname.startsWith('/app/scan')) {
    return { title: 'AI Scanner' };
  }
  if (pathname.startsWith('/app/sms')) {
    return { title: 'SMS Shield' };
  }
  if (pathname.startsWith('/app/alerts')) {
    return { title: 'Alert Center', showBack: true, backTo: '/app' };
  }
  if (pathname.startsWith('/app/profile/edit')) {
    return { title: 'Edit Profile', showBack: true, backTo: '/app/profile' };
  }
  if (pathname.startsWith('/app/profile/notifications')) {
    return { title: 'Notifications', showBack: true, backTo: '/app/profile' };
  }
  if (pathname.startsWith('/app/profile/privacy')) {
    return { title: 'Privacy Settings', showBack: true, backTo: '/app/profile' };
  }
  if (pathname.startsWith('/app/profile/ai')) {
    return { title: 'AI Preferences', showBack: true, backTo: '/app/profile' };
  }
  if (pathname.startsWith('/app/profile/plan')) {
    return { title: 'Current Plan', showBack: true, backTo: '/app/profile' };
  }
  if (pathname.startsWith('/app/profile')) {
    return { title: 'Profile' };
  }
  if (pathname.startsWith('/app/activity')) {
    return { title: 'Recent Activity', showBack: true, backTo: '/app' };
  }
  if (pathname.startsWith('/app/blocked-scans')) {
    return { title: 'Blocked Scans', showBack: true, backTo: '/app/profile' };
  }
  if (pathname.startsWith('/app/scam-alerts')) {
    return { title: 'Scam Alerts', showBack: true, backTo: '/app' };
  }
  return { title: 'ShieldAI' };
}
