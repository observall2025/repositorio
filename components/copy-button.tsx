"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useState } from "react";

type CopyButtonProps = {
  value: string;
  label: string;
  variant?: "view" | "direct";
};

export default function CopyButton({ value, label, variant = "view" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const Icon = copied ? Check : variant === "direct" ? Link2 : Copy;

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button className="icon-button" type="button" onClick={handleCopy} title={copied ? "Copiado" : label}>
      <Icon size={17} aria-hidden="true" />
      <span className="sr-only">{copied ? "Copiado" : label}</span>
    </button>
  );
}
