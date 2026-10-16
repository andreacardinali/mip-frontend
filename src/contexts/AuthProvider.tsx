import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import type { ReactNode } from "react";

import { getCurrentUser } from "../services/auth";

interface AuthContextType {
  user: any;
  loading: boolean;
  authenticated: boolean;
  logout: () => void;
}

const AuthContext =
  createContext<AuthContextType | null>(
    null
  );

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token =
        localStorage.getItem(
          "access_token"
        );

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const currentUser =
          await getCurrentUser();

        setUser(currentUser);
      } catch {
        localStorage.removeItem(
          "access_token"
        );
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const logout = () => {
    localStorage.removeItem(
      "access_token"
    );

    setUser(null);

    window.location.href =
      "/login";
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authenticated: !!user,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return context;
}