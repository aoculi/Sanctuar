import Background from "../Background";
import styles from "./styles.module.css";

export default function Interactible({
  tone = "light",
  children,
  onClick,
  className = "",
  isActive = false,
  ...props
}: {
  tone?: "light" | "dark";
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  isActive?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${styles.interactible} ${className}`}
      onClick={onClick}
      {...props}
    >
      <Background tone={tone} isActive={isActive} onEffect={true} />
      {children}
    </button>
  );
}
