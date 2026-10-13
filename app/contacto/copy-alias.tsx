'use client';

import { useState } from 'react';

export default function CopyAlias({ alias }: { alias: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="alias-copy" onClick={async () => {
      try { await navigator.clipboard.writeText(alias); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
    }}>
      <span className="headline">{alias}</span>
      <span>{copied ? '¡copiado!' : 'tocá para copiar el alias'}</span>
    </button>
  );
}
