"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";

type UserRole = "member" | "admin" | "superadmin";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  language?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for token and user info in localStorage on initial load
    try {
      const storedToken = localStorage.getItem("authToken");
      const storedUser = localStorage.getItem("user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        fetcher.setToken(storedToken);
      }
    } catch (error) {
      console.error("Failed to parse auth data from localStorage", error);
      // Clear corrupted data
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }, []);

  // Register logout callback with fetcher for 401 errors
  useEffect(() => {
    fetcher.setOnUnauthorized(() => {
      console.log("[Auth] JWT expired or invalid - logging out");
      logout();
    });

    return () => {
      fetcher.setOnUnauthorized(null);
    };
  }, []);

  const login = async (
    username: string,
    password: string,
  ): Promise<{ success: boolean; message?: string }> => {
    setLoading(true);
    try {
      const data = await fetcher.post<{ token: string; user: User }>(
        "/api/auth/login",
        { username, password },
        {},
        true,
      );

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      fetcher.setToken(data.token);
      return { success: true };
    } catch (error: any) {
      console.error("Login error:", error);
      // Ensure everything is cleared on failure
      logout();
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    fetcher.setToken(null);
    router.push("/login");
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
