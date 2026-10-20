import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  getCurrentUser,
  type CurrentUser,
} from "../services/auth";

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  authenticated: boolean;
  refreshUser: () => Promise<CurrentUser | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      localStorage.removeItem("access_token");
      setUser(null);
      return null;
    }
  }

  useEffect(() => {
    void refreshUser().finally(() => setLoading(false));
  }, []);

  function logout() {
    localStorage.removeItem("access_token");
    setUser(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authenticated: Boolean(user),
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
