import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Activity, Search, User, FileText, ArrowRightLeft, UserPlus, Upload, RefreshCw, Edit } from 'lucide-react';

const ACTION_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  note:       { label: 'Note Added',    icon: FileText,       color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  assignment: { label: 'Assigned',      icon: UserPlus,       color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  transfer:   { label: 'Transferred',   icon: ArrowRightLeft,  color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  update:     { label: 'Updated',       icon: Edit,           color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  import:     { label: 'Import',        icon: Upload,         color: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
  status_change: { label: 'Status Changed', icon: RefreshCw,  color: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function ActivityPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterAction, setFilterAction] = useState('all');

  const { data: profiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data ?? [];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['all-leads-map'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('id, full_name, phone, country');
      return data ?? [];
    },
  });

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['activity-logs-full', filterAgent, filterAction],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('*, lead:leads(id, full_name, country, phone)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (filterAgent !== 'all') query = query.eq('user_id', filterAgent);
      if (filterAction !== 'all') query = query.eq('action_type', filterAction);
      const { data } = await query;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const getAgent = (id: string) => profiles.find(p => p.id === id);
  const getLead = (id: string) => leads.find(l => l.id === id);

  const filtered = logs.filter(log => {
    if (!search) return true;
    const agent = getAgent(log.user_id)?.full_name?.toLowerCase() ?? '';
    const lead = ((log as any).lead ?? getLead(log.lead_id ?? ''))?.full_name?.toLowerCase() ?? '';
    const desc = log.description?.toLowerCase() ?? '';
    const s = search.toLowerCase();
    return agent.includes(s) || lead.includes(s) || desc.includes(s);
  });

  // Agent stats
  const agentStats = profiles.map(p => {
    const agentLogs = logs.filter(l => l.user_id === p.id);
    return { ...p, count: agentLogs.length };
  }).filter(p => p.count > 0).sort((a, b) => b.count - a.count);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Activity Feed</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Real-time team activity across all leads</p>
          </div>
          <button onClick={() => refetch()} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 border border-border px-3 py-1.5 rounded">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {/* Agent Stats Row - admin only */}
        {isAdmin && agentStats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {agentStats.map(agent => (
              <Card key={agent.id} className="premium-card cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setFilterAgent(agent.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">{agent.full_name?.charAt(0)}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{agent.full_name}</p>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{agent.count}</p>
                  <p className="text-xs text-muted-foreground">actions logged</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search agent, lead, or description..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          {isAdmin && (
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {Object.entries(ACTION_CONFIG).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterAgent !== 'all' || filterAction !== 'all' || search) && (
            <button onClick={() => { setFilterAgent('all'); setFilterAction('all'); setSearch(''); }} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded">
              Clear filters
            </button>
          )}
        </div>

        {/* Activity List */}
        <Card className="premium-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {filtered.length} activities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No activity found</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((log: any) => {
                  const agent = getAgent(log.user_id);
                  const lead = (log as any).lead ?? getLead(log.lead_id ?? '');
                  const config = ACTION_CONFIG[log.action_type] ?? { label: log.action_type, icon: Activity, color: 'bg-muted text-muted-foreground border-border' };
                  const Icon = config.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      {/* Action icon */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${config.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {/* Agent */}
                          <span className="text-sm font-semibold text-foreground">
                            {agent?.full_name ?? 'System'}
                          </span>
                          <span className="text-xs text-muted-foreground">{config.label}</span>
                          {/* Lead link */}
                          {lead && (
                            <>
                              <span className="text-xs text-muted-foreground">on</span>
                              <button
                                onClick={() => navigate(`/leads/${lead.id}`)}
                                className="text-xs font-medium text-primary hover:underline truncate max-w-48"
                              >
                                {lead.full_name}
                                {lead.country && <span className="text-muted-foreground font-normal ml-1">({lead.country})</span>}
                              </button>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{log.description}</p>
                      </div>

                      {/* Time + badge */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">{timeAgo(log.created_at)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
