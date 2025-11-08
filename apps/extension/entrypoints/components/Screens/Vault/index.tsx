import { Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";

import { keystoreManager } from "@/entrypoints/store/keystore";
import { sessionManager } from "@/entrypoints/store/session";
import { useBookmarks, useTags } from "../../../hooks/bookmarks";
import { useManifest } from "../../../hooks/vault";
import { useNavigation } from "../../App";
import Bookmarks from "../../Bookmarks";
import Tags from "../../Tags";

import styles from "./styles.module.css";

export default function Vault() {
  const { mutation, store } = useManifest();
  const { bookmarks } = useBookmarks();
  const { tags } = useTags();
  const { navigate } = useNavigation();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [currentTagId, setCurrentTagId] = useState<string | null>("all");

  // Initialize keystore state and listen for lock events
  // Note: App component handles initial mount check and redirect,
  // so this component should only render if keystore is unlocked
  useEffect(() => {
    const initializeKeystore = async () => {
      try {
        const unlocked = await keystoreManager.isUnlocked();
        setIsUnlocked(unlocked);
      } catch (error) {
        setIsUnlocked(false);
      } finally {
        setIsChecking(false);
      }
    };

    initializeKeystore();

    // Listen for runtime keystore lock events (auto-lock timeout, etc.)
    const unsubscribe = sessionManager.onUnauthorized(() => {
      setIsUnlocked(false);
      navigate("/login");
    });

    return unsubscribe;
  }, [navigate]);

  // Show messages for manifest operations
  useEffect(() => {
    if (mutation.isSuccess) {
      setMessage("Changes saved successfully");
      setTimeout(() => setMessage(null), 3000);
    } else if (mutation.isError) {
      const error = mutation.error as any;
      if (error?.details?.offline) {
        setMessage("Working offline—will retry");
      } else {
        setMessage("Failed to save changes");
        setTimeout(() => setMessage(null), 3000);
      }
    }
  }, [mutation.isSuccess, mutation.isError]);

  const onSelectTag = (id: string) => {
    setCurrentTagId(id);
  };

  // Show loading if still checking, or if unlocked but manifest not loaded yet
  const isManifestLoading = isUnlocked && !store.manifest;

  if (isChecking || isManifestLoading) {
    return (
      <div className={styles.container}>
        <Text>Checking vault status...</Text>
      </div>
    );
  }

  // If we reach here and keystore is locked, we're redirecting (safety check)
  if (!isUnlocked || !store.manifest) {
    return (
      <div className={styles.container}>
        <Text>Redirecting to login...</Text>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Tags
        bookmarks={bookmarks}
        currentTagId={currentTagId}
        onSelectTag={onSelectTag}
      />

      <Bookmarks tags={tags} message={message} setMessage={setMessage} />
    </div>
  );
}
