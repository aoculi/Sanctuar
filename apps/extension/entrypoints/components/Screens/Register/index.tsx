import { Button, Callout, Heading, TextField } from "@radix-ui/themes";
import { AlertCircle, KeyRound, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { useRegisterAndLogin } from "../../../hooks/auth";
import { whenCryptoReady } from "../../../lib/cryptoEnv";
import { useNavigation } from "../../App";

import styles from "./styles.module.css";

interface RegisterProps {
  onRegisterSuccess: () => void;
}

export default function Register({ onRegisterSuccess }: RegisterProps) {
  const [formData, setFormData] = useState({
    login: "",
    password: "",
  });
  const [error, setError] = useState<string | string[] | null>(null);
  const [cryptoReady, setCryptoReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const registerMutation = useRegisterAndLogin();
  const { navigate } = useNavigation();

  // Check sodium ready state
  useEffect(() => {
    const checkCryptoReady = async () => {
      try {
        await whenCryptoReady();
        setCryptoReady(true);
      } catch (error) {
        console.error("Failed to initialize crypto:", error);
        setError(
          "Failed to initialize encryption. Please refresh the extension."
        );
      } finally {
        setIsInitializing(false);
      }
    };

    checkCryptoReady();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cryptoReady) {
      setError("Encryption not ready. Please wait...");
      return;
    }

    if (!formData.login.trim() || !formData.password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    try {
      await registerMutation.mutateAsync({
        login: formData.login.trim(),
        password: formData.password,
      });

      // Success - registration, login, and unlock completed
      onRegisterSuccess();
    } catch (err: any) {
      // Handle WMK upload failure differently - keep session, allow retry
      const apiError = err as {
        status?: number;
        message?: string;
        details?: Record<string, any>;
      };

      if (apiError.details?.wmkUploadFailed) {
        // WMK upload failed - show error but keep session
        setError("Could not initialize vault. Please try again.");
        return;
      }

      // Handle other errors
      const baseMessage = apiError.message || "Registration failed";
      const details = apiError.details as Record<string, string[]> | undefined;

      if (details && typeof details === "object" && !details.wmkUploadFailed) {
        const lines: string[] = [];
        for (const [field, messages] of Object.entries(details)) {
          if (Array.isArray(messages) && messages.length > 0) {
            lines.push(`${field}: ${messages.join(", ")}`);
          }
        }
        setError(lines.length > 0 ? [baseMessage, ...lines] : baseMessage);
      } else {
        setError(baseMessage);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const initializing =
    registerMutation.isPending || !cryptoReady || isInitializing;

  const disabled =
    initializing || !formData.login.trim() || !formData.password.trim();

  return (
    <div className={styles.container}>
      <div className={styles.special} />

      <div className={styles.content}>
        <Heading size="8">LockMark</Heading>

        {error && (
          <Callout.Root color="red">
            <Callout.Icon>
              <AlertCircle />
            </Callout.Icon>
            <Callout.Text>
              {Array.isArray(error) ? (
                <ul>
                  {error.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              ) : (
                error
              )}
            </Callout.Text>
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

          <Button type="submit" disabled={disabled}>
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
