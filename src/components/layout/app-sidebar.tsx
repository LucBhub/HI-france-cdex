"use client";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  Shield,
  LogOut,
  UserCog,
  Wind,
  BarChart3,
  Network,
  TerminalSquare,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();
  const { language } = useLanguage();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const getInitials = (username: string = "") => {
    return username.charAt(0).toUpperCase();
  };

  // Don't render sidebar on login page or while auth is loading
  if (pathname === "/login" || loading) {
    return null;
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 whitespace-nowrap overflow-hidden"
        >
          <div className="p-2 bg-primary rounded-lg">
            <Shield className="text-primary-foreground h-6 w-6" />
          </div>
          <h1 className="font-headline text-2xl font-semibold text-primary group-data-[collapsible=icon]:hidden">
            {t("hypervisor", language)}
          </h1>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/"}
              tooltip="Dashboard"
            >
              <Link href="/" className="flex items-center gap-2 w-full">
                <LayoutDashboard />
                <span>{t("dashboard", language)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={
                pathname === "/synoptic" || pathname.startsWith("/plant/")
              }
              tooltip="Synoptic"
            >
              <Link href="/synoptic" className="flex items-center gap-2 w-full">
                <Wind />
                <span>{t("synoptic", language)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/reports"}
              tooltip={t("reports", language)}
            >
              <Link href="/reports" className="flex items-center gap-2 w-full">
                <BarChart3 />
                <span>{t("reports", language)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/architecture"}
              tooltip="Architecture"
            >
              <Link
                href="/architecture"
                className="flex items-center gap-2 w-full"
              >
                <Network />
                <span>Architecture</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/commands"}
              tooltip="Commandes"
            >
              <Link href="/commands" className="flex items-center gap-2 w-full">
                <TerminalSquare />
                <span>Commandes</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {(user?.role === "admin" || user?.role === "superadmin") && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/settings"}
                tooltip="Settings"
              >
                <Link
                  href="/settings"
                  className="flex items-center gap-2 w-full"
                >
                  <Settings />
                  <span>{t("settings", language)}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {user?.role === "superadmin" && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/admin"}
                tooltip="Admin Panel"
              >
                <Link href="/admin" className="flex items-center gap-2 w-full">
                  <UserCog />
                  <span>{t("adminPanel", language)}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-3 w-full">
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={`https://api.dicebear.com/8.x/identicon/svg?seed=${user?.email}`}
              alt="Avatar"
            />
            <AvatarFallback>{getInitials(user?.username)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground">{user?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 group-data-[collapsible=icon]:mx-auto"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
