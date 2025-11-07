import {
  Button,
  Checkbox,
  Flex,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";

import { sessionManager } from "@/entrypoints/store/session";
import {
  settingsStore,
  type AutoLockTimeout,
} from "@/entrypoints/store/settings";
import { useNavigation } from "../../App";

import Menu from "../../Menu";
import styles from "./styles.module.css";

export default function Settings() {
  const [fields, setFields] = useState({
    showHiddenTags: false,
    apiUrl: "",
    autoLockTimeout: "20min" as AutoLockTimeout,
  });
  const [originalFields, setOriginalFields] = useState({
    showHiddenTags: false,
    apiUrl: "",
    autoLockTimeout: "20min" as AutoLockTimeout,
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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
        showHiddenTags: currentState.showHiddenTags || false,
        apiUrl: currentState.apiUrl || "",
        autoLockTimeout: currentState.autoLockTimeout || "20min",
      });
      setOriginalFields({
        showHiddenTags: currentState.showHiddenTags || false,
        apiUrl: currentState.apiUrl || "",
        autoLockTimeout: currentState.autoLockTimeout || "20min",
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
        autoLockTimeout: state.autoLockTimeout,
      });
      setOriginalFields({
        showHiddenTags: state.showHiddenTags,
        apiUrl: state.apiUrl,
        autoLockTimeout: state.autoLockTimeout,
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
  const portalContainer = useMemo(
    () => document.getElementById("root") ?? undefined,
    []
  );

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
          <div className={styles.col}>
            <div className={styles.field}>
              <Text as="label" size="2" weight="medium">
                API Base URL
              </Text>
              <TextField.Root
                type="url"
                placeholder="http://127.0.0.1:3500"
                value={fields.apiUrl}
                onChange={(e) =>
                  setFields({ ...fields, apiUrl: e.target.value })
                }
              />
              <Text size="1" color="gray">
                Enter the base URL for the API endpoint
              </Text>
            </div>

            <div className={styles.field}>
              <Text as="label" size="2">
                <Flex gap="2" align="center">
                  <Checkbox
                    className={styles.checkbox}
                    checked={fields.showHiddenTags}
                    onCheckedChange={(checked) =>
                      setFields({ ...fields, showHiddenTags: checked === true })
                    }
                  />
                  Display hidden tags
                </Flex>
              </Text>
            </div>
          </div>

          <div className={styles.col}>
            <div className={styles.field}>
              <Text as="label" size="2" weight="medium">
                Auto-lock Timeout
              </Text>
              <select
                className={styles.select}
                defaultValue={fields.autoLockTimeout}
                onChange={(e) =>
                  setFields((prev: any) => ({
                    ...prev,
                    autoLockTimeout: e.target.value,
                  }))
                }
              >
                <option value="1min">1 minute</option>
                <option value="2min">2 minutes</option>
                <option value="5min">5 minutes</option>
                <option value="10min">10 minutes</option>
                <option value="20min">20 minutes</option>
                <option value="30min">30 minutes</option>
                <option value="1h">1 hour</option>
              </select>

              <Text size="1" color="gray">
                Automatically lock the vault after inactivity
              </Text>
            </div>

            <Button type="submit" disabled={!hasChanged || isSaved}>
              {isSaved ? "Saved!" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
