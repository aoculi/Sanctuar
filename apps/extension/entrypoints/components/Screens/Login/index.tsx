import { Callout, TextField } from "@radix-ui/themes";
import { AlertCircle, KeyRound, Loader2, Mail } from "lucide-react";

import { useLoginAndUnlock } from "@/entrypoints/components/hooks/auth";
import { useAuthForm } from "@/entrypoints/components/hooks/useAuthForm";
import Menu from "@/entrypoints/components/parts/Menu";
import Button from "@/entrypoints/components/ui/Button";
import Text from "@/entrypoints/components/ui/Text";
import { useNavigation } from "..";

import styles from "./styles.module.css";

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const loginMutation = useLoginAndUnlock();
  const { navigate } = useNavigation();

  const {
    formData,
    error,
    isInitializing,
    initializing,
    disabled,
    handleSubmit,
    handleChange,
  } = useAuthForm({
    onSuccess: onLoginSuccess,
    mutation: loginMutation,
  });

  return (
    <div className={styles.container}>
      <div className={styles.special} />

      <div className={styles.menu}>
        <Menu />
      </div>

      <div className={styles.content}>
        <Text as="h1" size="6" weight="medium">
          LockMark
        </Text>

        {error && (
          <Callout.Root color="red">
            <Callout.Icon>
              <AlertCircle />
            </Callout.Icon>
            <div>
              {Array.isArray(error) ? (
                <ul>
                  {error.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              ) : (
                error
              )}
            </div>
          </Callout.Root>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <TextField.Root
            size="3"
            placeholder="Email or username"
            name="login"
            value={formData.login}
            onChange={handleChange}
            disabled={loginMutation.isPending}
            autoFocus
          >
            <TextField.Slot>
              <Mail height="16" width="16" />
            </TextField.Slot>
          </TextField.Root>

          <TextField.Root
            size="3"
            placeholder="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            disabled={loginMutation.isPending}
          >
            <TextField.Slot>
              <KeyRound height="16" width="16" />
            </TextField.Slot>
          </TextField.Root>

          <Button disabled={disabled}>
            {initializing && <Loader2 className={styles.spinner} />}
            {isInitializing
              ? "Initializing..."
              : loginMutation.isPending
              ? "Logging in..."
              : "Unlock Vault"}
          </Button>
        </form>
        <div className={styles.registerLink}>
          <Button variant="ghost" onClick={() => navigate("/register")}>
            Not registered? Create an account
          </Button>
        </div>
      </div>
    </div>
  );
}
