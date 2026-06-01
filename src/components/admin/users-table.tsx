import { useState } from "react";
import { type User } from "@/contexts/auth-context";
import { deleteUser, updateUserRole, sendUserResetPassword } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Mail, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/contexts/language-context";

interface UsersTableProps {
  initialUsers: User[];
  onUserDeleted: (deletedUserId: number) => void;
}

export function UsersTable({ initialUsers, onUserDeleted }: UsersTableProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [resettingId, setResettingId] = useState<number | null>(null);

  // Update local state when initialUsers change (e.g. user added)
  if (
    initialUsers.length !== users.length &&
    initialUsers.length > users.length
  ) {
    setUsers(initialUsers);
  }

  const handleDelete = async (id: number) => {
    const result = await deleteUser(id);
    if (result.success) {
      onUserDeleted(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } else {
      toast({
        variant: "destructive",
        title: t("error", language),
        description: result.message || t("failedToDeleteUser", language),
      });
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    const result = await updateUserRole(userId, newRole);
    if (result.success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as any } : u)),
      );
      toast({
        title: t("success", language),
        description: "Role updated successfully.",
      });
    } else {
      toast({
        variant: "destructive",
        title: t("error", language),
        description: result.message || "Failed to update role.",
      });
    }
  };

  const handleResetPassword = async (userId: number) => {
    setResettingId(userId);
    const result = await sendUserResetPassword(userId);
    setResettingId(null);

    if (result.success) {
      toast({
        title: t("success", language),
        description: "Password reset email sent.",
      });
    } else {
      toast({
        variant: "destructive",
        title: t("error", language),
        description: result.message || "Failed to send reset email.",
      });
    }
  };

  const roleBadgeVariant = {
    superadmin: "destructive" as const,
    admin: "default" as const,
    member: "secondary" as const,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("manageExistingUsers", language)}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("username", language)}</TableHead>
              <TableHead>{t("email", language)}</TableHead>
              <TableHead>{t("role", language)}</TableHead>
              <TableHead className="text-right">
                {t("actions", language)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {currentUser?.role === "superadmin" &&
                  user.id !== currentUser.id ? (
                    <Select
                      defaultValue={user.role}
                      onValueChange={(val) => handleRoleChange(user.id, val)}
                    >
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="superadmin">Superadmin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={roleBadgeVariant[user.role]}>
                      {user.role}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {currentUser?.role === "superadmin" && (
                    <Button
                      variant="outline" // changed from ghost to outline for visibility
                      size="icon" // keep icon size
                      disabled={resettingId === user.id}
                      onClick={() => handleResetPassword(user.id)}
                      title="Send Reset Password Email"
                    >
                      {resettingId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {user.role !== "superadmin" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={user.id === currentUser?.id}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("areYouSure", language)}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("deleteUserWarning", language)}{" "}
                            <strong>{user.username}</strong>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("cancel", language)}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(user.id)}
                          >
                            {t("continue", language)}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
