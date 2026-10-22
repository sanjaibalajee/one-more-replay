"use client";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useEffect, useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

export const preference = (): Theme => {
  try {
    const value = localStorage.getItem("replay-theme");
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};

export const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener("replay-theme-change", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("replay-theme-change", notify);
  };
};

export const serverPreference = (): Theme => "system";

export function ThemeControl() {
  const theme = useSyncExternalStore(subscribe, preference, serverPreference);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return (
    <Label className="theme-control">
      <span>Appearance</span>
      <NativeSelect
        aria-label="Appearance"
        value={theme}
        onChange={(event) => {
          try {
            localStorage.setItem("replay-theme", event.target.value);
            window.dispatchEvent(new Event("replay-theme-change"));
          } catch {
            document.documentElement.dataset.theme =
              event.target.value === "system"
                ? window.matchMedia("(prefers-color-scheme: dark)").matches
                  ? "dark"
                  : "light"
                : event.target.value;
          }
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </NativeSelect>
    </Label>
  );
}
