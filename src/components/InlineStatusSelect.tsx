import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_LABELS, STATUS_COLORS, STATUS_OPTIONS, StatusBadge } from '@/components/StatusBadges';
import type { Database } from '@/integrations/supabase/types';

type InterestedStatus = Database['public']['Enums']['interested_status'];

interface InlineStatusSelectProps {
  value: InterestedStatus | null;
  onValueChange: (value: InterestedStatus) => void;
  disabled?: boolean;
}

export function InlineStatusSelect({ value, onValueChange, disabled }: InlineStatusSelectProps) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={value ?? undefined}
        onValueChange={(v) => onValueChange(v as InterestedStatus)}
        disabled={disabled}
      >
        <SelectTrigger className="border-0 bg-transparent h-auto p-0 shadow-none focus:ring-0 focus:ring-offset-0 w-auto min-w-0 [&>svg]:ml-1 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-0 hover:[&>svg]:opacity-50">
          <SelectValue>
            <StatusBadge status={value} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[s]}`}>
                {STATUS_LABELS[s]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
