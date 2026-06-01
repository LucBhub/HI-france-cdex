"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let isMounted = true;

    const exchangeToken = async () => {
      // Forcing relative path to hit NextJS rewrites and bypass raw IP
      const apiUrl = "";

      try {
        const res = await fetch(`${apiUrl}/api/auth/azure/exchange`, {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Exchange HTTP error");
        }

        const data = await res.json();
        if (!data.success || !data.token) {
          throw new Error("Invalid exchange response");
        }

        const token = data.token;

        if (isMounted) {
          // 1. Save Token with correct key
          localStorage.setItem("authToken", token);

          // 2. Decode Token to get User info (simplistic decode)
          const base64Url = token.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            window
              .atob(base64)
              .split("")
              .map(function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
              })
              .join(""),
          );

          const decoded = JSON.parse(jsonPayload);

          // 3. Save User info expected by AuthProvider
          const user = {
            id: decoded.id,
            username: decoded.username,
            email: decoded.email,
            role: decoded.role,
          };
          localStorage.setItem("user", JSON.stringify(user));

          // Delay redirection to show the success message
          setTimeout(() => {
            window.location.href = "/";
          }, 2000);
        }
      } catch (e) {
        console.error("Error decoding token", e);
        if (isMounted) {
          router.push("/login?error=invalid_token");
        }
      }
    };

    exchangeToken();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm p-6 bg-card rounded-xl shadow-lg border text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Connexion réussie !
          </h1>
          <p className="text-muted-foreground">Bienvenue sur l'Hyperviseur.</p>
        </div>

        <div className="flex flex-col items-center gap-2 pt-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <p className="text-xs text-muted-foreground">
            Redirection vers le tableau de bord...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginSuccessContent />
    </Suspense>
  );
}
