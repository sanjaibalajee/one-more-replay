"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function WorkspacePage({
  open,
  close,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  close: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!open) return;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [open]);
  if (!open) return null;
  return (
    <section
      className={`workspace-page ${wide ? "workspace-page-wide" : ""}`}
      aria-labelledby="workspace-page-title"
    >
      <Button variant="ghost" className="page-back" onClick={close}>
        <ArrowLeft size={16} />
        Back
      </Button>
      <header className="workspace-page-heading">
        <h1 id="workspace-page-title" ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}
