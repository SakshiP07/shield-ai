interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
  clientId?: string;
  client_id?: string;
}

interface GoogleIdentityServices {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    ux_mode?: 'popup' | 'redirect';
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: Record<string, string | number | undefined>,
  ) => void;
}

interface GoogleAccounts {
  id: GoogleIdentityServices;
}

interface GoogleGlobal {
  accounts: GoogleAccounts;
}

interface Window {
  google?: GoogleGlobal;
}
