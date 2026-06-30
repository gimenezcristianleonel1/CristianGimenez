// Minimal typings for Google Identity Services (loaded from gstatic at runtime).
interface GsiCredentialResponse {
  credential: string;
}

interface GsiIdConfig {
  client_id: string;
  callback: (response: GsiCredentialResponse) => void;
  auto_select?: boolean;
}

interface GsiButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'small' | 'medium' | 'large';
  type?: 'standard' | 'icon';
  shape?: 'rectangular' | 'pill';
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  width?: number;
  locale?: string;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: GsiIdConfig) => void;
        renderButton: (parent: HTMLElement, options: GsiButtonOptions) => void;
        prompt: () => void;
      };
    };
  };
}
