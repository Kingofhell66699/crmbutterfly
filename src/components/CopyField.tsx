import { Copy, Check, Phone } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function CopyField({ value, type }: { value: string; type: 'phone' | 'email' }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast({ title: type === 'phone' ? 'Phone copied' : 'Email copied', duration: 1500 });
    setTimeout(() => setCopied(false), 2000);
  };

  if (type === 'email') {
    return (
      <span className="inline-flex items-center gap-1 group">
        <a href={`mailto:${value}`} className="clickable-field" onClick={(e) => e.stopPropagation()}>
          {value}
        </a>
        <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity">
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 group">
      <button onClick={handleCopy} className="clickable-field">{value}</button>
      {copied ? <Check className="h-3 w-3 text-success" /> : (
        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </span>
  );
}

/** Standalone click-to-call button for the C2C column */
export function CallButton({ phone }: { phone: string }) {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  const telHref = cleaned.startsWith('+') ? cleaned : (cleaned.startsWith('00') ? '+' + cleaned.slice(2) : '+' + cleaned);

  return (
    <a
      href={`tel:${telHref}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      title="Call with Zoiper"
    >
      <Phone className="h-3.5 w-3.5" />
    </a>
  );
}
