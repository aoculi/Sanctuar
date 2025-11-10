import { Callout, TextField } from "@radix-ui/themes";
import { AlertCircle, KeyRound, Loader2, Mail } from "lucide-react";

import { useRegisterAndLogin } from "@/entrypoints/components/hooks/auth";
import { useAuthForm } from "@/entrypoints/components/hooks/useAuthForm";
import Menu from "@/entrypoints/components/parts/Menu";
import Button from "@/entrypoints/components/ui/Button";
import Text from "@/entrypoints/components/ui/Text";
import { useNavigation } from "..";

import styles from "./styles.module.css";

interface RegisterProps {
  onRegisterSuccess: () => void;
}

export default function Register({ onRegisterSuccess }: RegisterProps) {
  const registerMutation = useRegisterAndLogin();
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
    onSuccess: onRegisterSuccess,
    mutation: registerMutation,
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
            disabled={registerMutation.isPending}
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
            disabled={registerMutation.isPending}
          >
            <TextField.Slot>
              <KeyRound height="16" width="16" />
            </TextField.Slot>
          </TextField.Root>

          <Button disabled={disabled}>
            {initializing && <Loader2 className={styles.spinner} />}
            {isInitializing
              ? "Initializing..."
              : registerMutation.isPending
              ? "Creating account..."
              : "Create Account"}
          </Button>
        </form>

        <div className={styles.loginLink}>
          <Button variant="ghost" onClick={() => navigate("/login")}>
            Already have an account? Sign in
          </Button>
        </div>
      </div>
    </div>
  );
}
