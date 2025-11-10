import { AlertCircle } from "lucide-react";

import styles from "./styles.module.css";

interface ErrorCalloutProps {
  children: string | string[];
}

export default function ErrorCallout({ children }: ErrorCalloutProps) {
  return (
    <div className={styles.root}>
      <div className={styles.icon}>
        <AlertCircle size={16} />
      </div>
      <div className={styles.content}>
        {Array.isArray(children) ? (
          <ul className={styles.list}>
            {children.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
