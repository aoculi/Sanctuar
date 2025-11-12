import React from "react";

import styles from "./styles.module.css";

function Text({
  size = "2",
  weight = "regular",
  as = "div",
  color = "inherit",
  children,
  style,
}: {
  size?: "1" | "2" | "3" | "4" | "5" | "6";
  weight?: "light" | "regular" | "medium" | "bold";
  as?: "label" | "p" | "div" | "h1";
  color?: "inherit" | "light" | "primary" | "white";
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const className = `${styles.text} ${styles["size-" + size]} ${
    styles["weight-" + weight]
  } ${styles["color-" + color]}`;

  if (as === "label") {
    return (
      <label className={className} style={style}>
        {children}
      </label>
    );
  }
  if (as === "p") {
    return (
      <p className={className} style={style}>
        {children}
      </p>
    );
  }
  if (as === "h1") {
    return (
      <h1 className={className} style={style}>
        {children}
      </h1>
    );
  }
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

export default Text;
