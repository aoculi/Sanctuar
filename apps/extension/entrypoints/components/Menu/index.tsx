import { Button, DropdownMenu } from "@radix-ui/themes";
import {
  Bookmark,
  Key,
  LockKeyhole,
  Menu as MenuIcon,
  Settings,
  UserPlus,
} from "lucide-react";

import { useLogout } from "@/entrypoints/hooks/useLogout";
import { Route, useNavigation } from "../App";

import styles from "./styles.module.css";

export default function Menu({
  isConnected = false,
}: {
  isConnected?: boolean;
}) {
  const logoutMutation = useLogout();
  const { navigate } = useNavigation();

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
        <Button variant="soft" className={styles.menuButton}>
          <MenuIcon strokeWidth={1} size={18} />
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

        <DropdownMenu.Item onClick={() => handleNavigation("/settings")}>
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
