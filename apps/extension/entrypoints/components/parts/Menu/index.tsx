import {
  Bookmark,
  Key,
  LockKeyhole,
  Menu as MenuIcon,
  Settings,
  UserPlus,
} from "lucide-react";

import { useLogout } from "@/entrypoints/components/hooks/auth";
import type { Route } from "@/entrypoints/components/Screens";
import { useNavigation } from "@/entrypoints/components/Screens";
import Button from "@/entrypoints/components/ui/Button";
import { DropdownMenu } from "@/entrypoints/components/ui/DropdownMenu";

export default function Menu({
  isConnected = false,
}: {
  isConnected?: boolean;
}) {
  const logoutMutation = useLogout();
  const { navigate, openSettings } = useNavigation();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (err) {
      // Error handling done via logoutMutation.error in UI
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path as Route);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button asIcon color="dark" variant="ghost" size="sm">
          <MenuIcon strokeWidth={2} size={18} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {!isConnected && (
          <>
            <DropdownMenu.Item onClick={() => handleNavigation("/login")}>
              <Key strokeWidth={1} size={18} /> Login
            </DropdownMenu.Item>

            <DropdownMenu.Item onClick={() => handleNavigation("/register")}>
              <UserPlus strokeWidth={1} size={18} /> Create account
            </DropdownMenu.Item>
          </>
        )}

        {isConnected && (
          <DropdownMenu.Item onClick={() => handleNavigation("/vault")}>
            <Bookmark strokeWidth={1} size={18} /> Bookmarks
          </DropdownMenu.Item>
        )}

        <DropdownMenu.Item onClick={openSettings}>
          <Settings strokeWidth={1} size={18} /> Settings
        </DropdownMenu.Item>

        {isConnected && (
          <DropdownMenu.Item onClick={handleLogout}>
            <LockKeyhole strokeWidth={1} size={18} />
            {logoutMutation.isPending ? "Logging out..." : "Lock extension"}
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
