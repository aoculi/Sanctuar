import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import React from "react";

import styles from "./styles.module.css";

const DropdownMenuRoot = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Trigger ref={ref} className={className} {...props} />
));
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      className={`${styles.content} ${className || ""}`}
      sideOffset={5}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

type DropdownMenuItemPrimitiveProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
>;

interface DropdownMenuItemProps
  extends Omit<DropdownMenuItemPrimitiveProps, "onSelect"> {
  color?: "default" | "red";
  onClick?: () => void;
  onSelect?: DropdownMenuItemPrimitiveProps["onSelect"];
}

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(({ className, color = "default", onClick, onSelect, ...props }, ref) => {
  const handleSelect: DropdownMenuItemPrimitiveProps["onSelect"] = (event) => {
    // Call onClick if provided
    if (onClick) {
      onClick();
    }
    // Call original onSelect if provided
    if (onSelect) {
      onSelect(event);
    }
  };

  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={`${styles.item} ${styles[`item-${color}`]} ${className || ""}`}
      onSelect={handleSelect}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={`${styles.separator} ${className || ""}`}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

// Export as namespace object to match Radix UI themes API
export const DropdownMenu = {
  Root: DropdownMenuRoot,
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
};
