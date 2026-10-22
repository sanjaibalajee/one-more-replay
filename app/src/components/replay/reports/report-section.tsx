"use client";
import { type ReactNode } from "react";

export function ReportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="report-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
