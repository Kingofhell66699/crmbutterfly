import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface InlineAgentSelectProps {
  value: string | null;
  agents: Profile[];
  onValueChange: (agentId: string) => void;
  disabled?: boolean;
}

export function InlineAgentSelect({ value, agents, onValueChange, disabled }: InlineAgentSelectProps) {
  const salesAgents = agents.filter(a => a.team === 'sales');
  const retentionAgents = agents.filter(a => a.team === 'retention');
  const currentName = value ? agents.find(a => a.id === value)?.full_name ?? 'Unknown' : 'Unassigned';

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={value ?? 'unassigned'}
        onValueChange={(v) => { if (v !== 'unassigned') onValueChange(v); }}
        disabled={disabled}
      >
        <SelectTrigger className="border-0 bg-transparent h-auto p-0 shadow-none focus:ring-0 focus:ring-offset-0 w-auto min-w-0 [&>svg]:ml-1 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-0 hover:[&>svg]:opacity-50">
          <SelectValue>
            <span className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground italic'}`}>
              {currentName}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {salesAgents.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs font-semibold text-blue-400">Sales Team</SelectLabel>
              {salesAgents.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
              ))}
            </SelectGroup>
          )}
          {retentionAgents.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs font-semibold text-amber-400">Retention Team</SelectLabel>
              {retentionAgents.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
