"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ReactNode } from "react";

export function Notice({
  children,
  danger = false,
}: {
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <Alert
      variant={danger ? "destructive" : "default"}
      className={`notice ${danger ? "danger" : ""}`}
    >
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
