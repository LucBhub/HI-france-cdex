"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { resetPassword, validateResetToken } from "@/lib/api";

type TokenStatus = "checking" | "invalid" | "expired" | "ready";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [status, setStatus] = useState<TokenStatus>("checking");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setStatus("invalid");
        return;
      }
      setStatus("checking");
      const result = await validateResetToken(token);
      if (!result.valid) {
        const message = (result.message || "").toLowerCase();
        if (message.includes("expired")) {
          setStatus("expired");
        } else {
          setStatus("invalid");
        }
        return;
      }
      setStatus("ready");
    }

    checkToken();
  }, [token]);

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Token manquant",
        description: "Le lien de réinitialisation est invalide.",
      });
      return;
    }
    const result = await resetPassword(token, values.password);
    if (result.success) {
      toast({
        title: "Mot de passe mis à jour",
        description:
          "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.",
      });
      router.push("/login");
    } else {
      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          result.message || "Impossible de réinitialiser le mot de passe.",
      });
    }
  };

  const renderContent = () => {
    switch (status) {
      case "checking":
        return (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">
              Vérification du lien…
            </p>
          </div>
        );
      case "invalid":
        return (
          <div className="space-y-4 py-6 text-center">
            <CardTitle className="text-xl">Lien invalide</CardTitle>
            <CardDescription>
              Le lien de réinitialisation n’est pas valide. Demandez un nouveau
              lien depuis l’écran de connexion.
            </CardDescription>
            <Button onClick={() => router.push("/login")}>
              Retour à la connexion
            </Button>
          </div>
        );
      case "expired":
        return (
          <div className="space-y-4 py-6 text-center">
            <CardTitle className="text-xl">Lien expiré</CardTitle>
            <CardDescription>
              Ce lien est arrivé à expiration. Demandez un nouveau lien depuis
              l’écran de connexion.
            </CardDescription>
            <Button onClick={() => router.push("/login")}>
              Retour à la connexion
            </Button>
          </div>
        );
      case "ready":
      default:
        return (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="********"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmez le mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="********"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? "Réinitialisation…"
                  : "Enregistrer le nouveau mot de passe"}
              </Button>
            </form>
          </Form>
        );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">
            Réinitialisation du mot de passe
          </CardTitle>
          <CardDescription>
            Choisissez un nouveau mot de passe pour votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground">Chargement…</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
