import { Button, Checkbox, Flex, Heading, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";

import { sessionManager } from "@/entrypoints/store/session";
import { settingsStore } from "@/entrypoints/store/settings";
import { useNavigation } from "../../App";

import Menu from "../../Menu";
import styles from "./styles.module.css";

export default function Settings() {
  const { navigate } = useNavigation();
  const [showHiddenTags, setShowHiddenTags] = useState(false);
  const [originalValue, setOriginalValue] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Check session status
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await sessionManager.getSession();
        // Check if session exists and hasn't expired
        const hasValidSession =
          session !== null && session.expiresAt > Date.now();
        setIsConnected(hasValidSession);
      } catch (error) {
        console.error("Error checking session:", error);
        setIsConnected(false);
      }
    };

    checkSession();

    // Listen for session changes
    const unsubscribe = sessionManager.onUnauthorized(() => {
      setIsConnected(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Load current setting on mount
    const loadSettings = async () => {
      setIsLoading(true);
      const currentState = await settingsStore.getState();
      setShowHiddenTags(currentState.showHiddenTags);
      setOriginalValue(currentState.showHiddenTags);
      setIsLoading(false);
    };

    loadSettings();

    // Subscribe to changes
    const unsubscribe = settingsStore.subscribe(async () => {
      const state = await settingsStore.getState();
      setShowHiddenTags(state.showHiddenTags);
      setOriginalValue(state.showHiddenTags);
    });

    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await settingsStore.setShowHiddenTags(showHiddenTags);
    setOriginalValue(showHiddenTags);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const hasChanged = showHiddenTags !== originalValue;

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <Text>Loading settings...</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.menu}>
        <Menu isConnected={isConnected} />
      </div>
      <div className={styles.content}>
        <Heading size="8">Settings</Heading>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                style={{ paddingBottom: 10 }}
                checked={showHiddenTags}
                onCheckedChange={(checked) =>
                  setShowHiddenTags(checked === true)
                }
              />
              Display hidden tags
            </Flex>
          </Text>

          <Button type="submit" disabled={!hasChanged || isSaved}>
            {isSaved ? "Saved!" : "Save"}
          </Button>
        </form>
      </div>
    </div>
  );
}
