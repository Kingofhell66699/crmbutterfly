import type { Database } from '@/integrations/supabase/types';

type InterestedStatus = Database['public']['Enums']['interested_status'];
type RetentionStatus = Database['public']['Enums']['retention_status'];
type LeadPriority = Database['public']['Enums']['lead_priority'];

// CRM-friendly labels mapped to existing enum values
export const STATUS_LABELS: Record<InterestedStatus, string> = {
  not_called: 'Not Called',
  callback_later: 'Initial Call',
  no_answer: 'No Answer',
  wrong_number: 'Wrong Number',
  hung_up: 'Hung Up',
  not_interested: 'Not Interested',
  interested: 'Interested',
  converted: 'FTD',
  wrong_info: 'Wrong Info',
};

export const STATUS_COLORS: Record<InterestedStatus, string> = {
  not_called: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  callback_later: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  no_answer: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  wrong_number: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  hung_up: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  not_interested: 'bg-red-500/15 text-red-400 border-red-500/30',
  interested: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  converted: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  wrong_info: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

// Ordered list for dropdown — only these 5 statuses
export const STATUS_OPTIONS: InterestedStatus[] = [
  'callback_later',
  'no_answer',
  'hung_up',
  'wrong_info',
  'converted',
];

export function StatusBadge({ status }: { status: InterestedStatus | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RetentionBadge({ status }: { status: RetentionStatus | null }) {
  if (!status) return null;
  const map: Record<RetentionStatus, string> = {
    new_to_retention: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    contacted: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    follow_up: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    deposited_converted: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    lost: 'bg-red-500/15 text-red-400 border-red-500/30',
    do_not_contact: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  };
  const labels: Record<RetentionStatus, string> = {
    new_to_retention: 'New',
    contacted: 'Contacted',
    follow_up: 'Follow Up',
    active: 'Active',
    deposited_converted: 'Converted',
    lost: 'Lost',
    do_not_contact: 'Do Not Contact',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

export const PRIORITY_OPTIONS: (LeadPriority | 'not_set')[] = ['not_set', 'low', 'medium', 'high'];

export function PriorityBadge({ priority }: { priority: LeadPriority | null }) {
  if (!priority) return <span className="inline-flex items-center justify-center rounded-full border border-muted-foreground/20 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground leading-normal whitespace-nowrap">Not Set</span>;
  const map: Record<LeadPriority, string> = {
    high: 'bg-red-500/15 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    low: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[priority]}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

export function TeamBadge({ team }: { team: 'sales' | 'retention' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
      team === 'sales' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    }`}>
      {team === 'sales' ? 'Sales' : 'Retention'}
    </span>
  );
}
