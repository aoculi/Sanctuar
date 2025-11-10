import styles from "./styles.module.css";

export default function Background({
  tone,
  isActive = false,
  onEffect = false,
}: {
  tone: "light" | "dark";
  isActive?: boolean;
  onEffect?: boolean;
}) {
  const stateClasses = [
    styles.background,
    styles[tone],
    isActive && styles.focused,
    onEffect && styles.on,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={stateClasses}></div>;
}
