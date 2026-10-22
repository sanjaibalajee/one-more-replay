"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Disclosure({
  title,
  children,
  className,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("replay-disclosure", className)}
    >
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className="disclosure-trigger">
          {title}
          <ChevronDown className="disclosure-chevron" size={14} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        forceMount
        hidden={!open}
        style={open ? undefined : { display: "none" }}
        className="disclosure-content"
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
