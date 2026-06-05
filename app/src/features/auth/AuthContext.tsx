import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  changePassword as changePasswordRequest,
  deleteAccount as deleteAccountRequest,
  getMe,
  getErrorMessage,
  login as loginRequest,
  logout as logoutRequest,
  refresh as refreshRequest,
  register as registerRequest,
  updateProfile as updateProfileRequest
} from "../../services/api-client";
import {
  getStoredDeveloperMode,
  getStoredDeviceGroupMode,
  saveDeveloperMode,
  saveDeviceGroupMode
} from "../../services/app-settings-storage";
import { clearTokens, getStoredTokens, saveTokens } from "../../services/token-storage";
import type { AppUser, AuthTokens } from "../../types/api";
import type { DeviceGroupMode } from "../devices/device-groups";

type SessionState = {
  user: AppUser;
  tokens: AuthTokens;
};

type AuthContextValue = {
  user: AppUser | null;
  accessToken: string | null;
  isBootstrapping: boolean;
  developerMode: boolean;
  deviceGroupMode: DeviceGroupMode;
  setDeveloperMode: (enabled: boolean) => Promise<void>;
  setDeviceGroupMode: (mode: DeviceGroupMode) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (input: { displayName: string }) => Promise<void>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isBootstrapping, setBootstrapping] = useState(true);
  const [developerMode, setDeveloperModeState] = useState(false);
  const [deviceGroupMode, setDeviceGroupModeState] = useState<DeviceGroupMode>("series");

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const storedDeveloperMode = await getStoredDeveloperMode();
        if (mounted) {
          setDeveloperModeState(storedDeveloperMode);
        }

        const storedDeviceGroupMode = await getStoredDeviceGroupMode();
        if (mounted) {
          setDeviceGroupModeState(storedDeviceGroupMode);
        }

        const storedTokens = await getStoredTokens();
        if (!storedTokens) {
          return;
        }

        try {
          const response = await getMe(storedTokens.accessToken);
          if (mounted) {
            setSession({ user: response.user, tokens: storedTokens });
          }
          return;
        } catch {
          const refreshed = await refreshRequest(storedTokens.refreshToken);
          await saveTokens(refreshed.tokens);
          if (mounted) {
            setSession({ user: refreshed.user, tokens: refreshed.tokens });
          }
        }
      } catch {
        await clearTokens();
        if (mounted) {
          setSession(null);
        }
      } finally {
        if (mounted) {
          setBootstrapping(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const currentSession = session;
    let cancelled = false;

    async function refreshSession() {
      try {
        const refreshed = await refreshRequest(currentSession.tokens.refreshToken);
        await saveTokens(refreshed.tokens);
        if (!cancelled) {
          setSession({ user: refreshed.user, tokens: refreshed.tokens });
        }
      } catch {
        await clearTokens();
        if (!cancelled) {
          setSession(null);
        }
      }
    }

    const expiresAt = new Date(currentSession.tokens.accessTokenExpiresAt).getTime();
    const refreshInMs = Number.isNaN(expiresAt)
      ? 0
      : Math.max(expiresAt - Date.now() - 60_000, 0);
    const timeout = setTimeout(() => {
      void refreshSession();
    }, refreshInMs);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.tokens.accessToken ?? null,
      isBootstrapping,
      developerMode,
      deviceGroupMode,
      async setDeveloperMode(enabled) {
        await saveDeveloperMode(enabled);
        setDeveloperModeState(enabled);
      },
      async setDeviceGroupMode(mode) {
        await saveDeviceGroupMode(mode);
        setDeviceGroupModeState(mode);
      },
      async signIn(email, password) {
        const response = await loginRequest({ email, password });
        await saveTokens(response.tokens);
        setSession({ user: response.user, tokens: response.tokens });
      },
      async signUp(input) {
        const response = await registerRequest(input);
        await saveTokens(response.tokens);
        setSession({ user: response.user, tokens: response.tokens });
      },
      async signOut() {
        const refreshToken = session?.tokens.refreshToken;
        try {
          if (refreshToken) {
            await logoutRequest(refreshToken);
          }
        } catch {
          // The local token clear is the important part for logout UX.
        } finally {
          await clearTokens();
          setSession(null);
        }
      },
      async updateProfile(input) {
        if (!session) {
          throw new Error("尚未登入");
        }

        const response = await updateProfileRequest(session.tokens.accessToken, input);
        setSession({ ...session, user: response.user });
      },
      async changePassword(input) {
        if (!session) {
          throw new Error("尚未登入");
        }

        await changePasswordRequest(session.tokens.accessToken, input);
        await clearTokens();
        setSession(null);
      },
      async deleteAccount() {
        if (!session) {
          throw new Error("尚未登入");
        }

        await deleteAccountRequest(session.tokens.accessToken);
        await clearTokens();
        setSession(null);
      }
    }),
    [developerMode, deviceGroupMode, isBootstrapping, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

export { getErrorMessage };
