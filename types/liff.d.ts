// LIFF SDK型定義の拡張
declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      logout: () => void;
      getProfile: () => Promise<{
        userId: string;
        displayName: string;
        pictureUrl?: string;
        statusMessage?: string;
      }>;
      getFriendship: () => Promise<{
        friendFlag: boolean;
      }>;
      openWindow: (params: {
        url: string;
        external?: boolean;
      }) => void;
      scanCodeV2?: () => Promise<{
        value: string | null;
      }>;
    };
  }
}

export {};
