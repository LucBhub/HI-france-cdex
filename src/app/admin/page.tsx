"use client";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import withAuth from "@/components/with-auth";
import { useEffect, useState } from "react";
import { User } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchUsers } from "@/lib/api";
import { AddUserForm } from "@/components/admin/add-user-form";
import { UsersTable } from "@/components/admin/users-table";
import { useToast } from "@/hooks/use-toast";

import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

// ... imports

function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { language } = useLanguage();

  const loadUsers = async () => {
    setLoading(true);
    const usersData = await fetchUsers();
    setUsers(usersData);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleUserAdded = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
    toast({
      title: t("success", language),
      description: t("userCreatedSuccess", language),
    });
  };

  const handleUserDeleted = (deletedUserId: number) => {
    setUsers((prev) => prev.filter((u) => u.id !== deletedUserId));
    toast({
      title: t("success", language),
      description: t("userDeletedSuccess", language),
    });
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col h-screen">
          <Header solarPlants={[]} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl font-bold mb-6">
                {t("adminPanel", language)}
              </h1>
              {loading ? (
                <div className="space-y-8">
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <div className="space-y-8">
                  <AddUserForm onUserAdded={handleUserAdded} />
                  <UsersTable
                    initialUsers={users}
                    onUserDeleted={handleUserDeleted}
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Only 'superadmin' can access this page.
export default withAuth(AdminPage, ["superadmin"]);
