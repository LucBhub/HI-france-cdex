"use client";

import React, { ComponentType, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

type Role = "member" | "admin" | "superadmin";

// This is a Higher-Order Component (HOC)
const withAuth = <P extends object>(
  WrappedComponent: ComponentType<P>,
  allowedRoles: Role[],
) => {
  const AuthComponent = (props: P) => {
    const router = useRouter();
    const { isAuthenticated, loading, user } = useAuth();

    useEffect(() => {
      // If auth state is still loading, do nothing yet.
      if (loading) {
        return;
      }

      // If user is not authenticated, redirect to login page.
      if (!isAuthenticated) {
        router.replace("/login");
        return;
      }

      // If user is authenticated, check if their role is allowed.
      if (user && !allowedRoles.includes(user.role)) {
        // Redirect to a more appropriate page, like the dashboard
        // or a dedicated 'unauthorized' page.
        router.replace("/");
      }
    }, [isAuthenticated, loading, user, router]);

    // While loading, you can show a loader or nothing
    if (
      loading ||
      !isAuthenticated ||
      (user && !allowedRoles.includes(user.role))
    ) {
      return (
        <div className="flex h-screen w-full items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
        </div>
      );
    }

    // If authenticated and authorized, render the component.
    return <WrappedComponent {...props} />;
  };

  // Set a display name for the HOC for better debugging
  AuthComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return AuthComponent;
};

export default withAuth;
