import {
  Button,
  Checkbox,
  Flex,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";

import { sessionManager } from "@/entrypoints/store/session";
import { settingsStore } from "@/entrypoints/store/settings";
import { useNavigation } from "../../App";
import Menu from "../../Menu";

import styles from "./styles.module.css";

export default function Settings() {
  const [fields, setFields] = useState({
    showHiddenTags: false,
    apiUrl: "",
  });
  const [originalFields, setOriginalFields] = useState({
    showHiddenTags: false,
    apiUrl: "",
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const { setFlash } = useNavigation();

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
      setFields({
        showHiddenTags: currentState.showHiddenTags,
        apiUrl: currentState.apiUrl,
      });
      setOriginalFields({
        showHiddenTags: currentState.showHiddenTags,
        apiUrl: currentState.apiUrl,
      });
      setIsLoading(false);
    };

    loadSettings();

    // Subscribe to changes
    const unsubscribe = settingsStore.subscribe(async () => {
      const state = await settingsStore.getState();
      setFields({
        showHiddenTags: state.showHiddenTags,
        apiUrl: state.apiUrl,
      });
      setOriginalFields({
        showHiddenTags: state.showHiddenTags,
        apiUrl: state.apiUrl,
      });
    });

    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlash(null);
    try {
      await settingsStore.setSettings(fields);
      setOriginalFields({ ...fields });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const hasChanged = JSON.stringify(fields) !== JSON.stringify(originalFields);

  const version = chrome.runtime.getManifest().version;

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

      <div className={styles.version}>
        Version: {import.meta.env.WXT_VERSION} : {version}
      </div>

      <div className={styles.content}>
        <Heading size="8">Settings</Heading>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                style={{ paddingBottom: 10 }}
                checked={fields.showHiddenTags}
                onCheckedChange={(checked) =>
                  setFields({ ...fields, showHiddenTags: checked === true })
                }
              />
              Display hidden tags
            </Flex>
          </Text>

          <Flex direction="column" gap="2" style={{ width: "100%" }}>
            <Text as="label" size="2" weight="medium">
              API Base URL
            </Text>
            <TextField.Root
              type="url"
              placeholder="http://127.0.0.1:3500"
              value={fields.apiUrl}
              onChange={(e) => setFields({ ...fields, apiUrl: e.target.value })}
            />
            <Text size="1" color="gray">
              Enter the base URL for the API endpoint
            </Text>
          </Flex>

          <Button type="submit" disabled={!hasChanged || isSaved}>
            {isSaved ? "Saved!" : "Save"}
          </Button>
        </form>
      </div>
    </div>
  );
}
