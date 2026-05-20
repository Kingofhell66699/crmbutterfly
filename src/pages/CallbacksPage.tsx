import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Clock, User, AlertCircle, CheckCircle, Calendar } from 'lucide-react';

function timeUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  if (diff < 0) return { label: 'Overdue', overdue: true };
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return { label: `in ${mins}m`, overdue: false };
  if (hours < 24) return { label: `in ${hours}h`, overdue: false };
  return { label: `in ${days}d`, overdue: false };
}

export default function CallbacksPage() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data ?? [];
    },
  });

  const { data: callbacks = [], isLoading } = useQuery({
    queryKey: ['callbacks', filterAgent, filterPeriod],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('id, full_name, phone, country, next_follow_up_date, callback_note, assigned_to, interested_status')
        .not('next_follow_up_date', 'is', null)
        .order('next_follow_up_date', { ascending: true });

      if (!isAdmin) query = query.eq('assigned_to', user!.id);
      if (filterAgent !== 'all') query = query.eq('assigned_to', filterAgent);

      const now = new Date();
      if (filterPeriod === 'overdue') query = query.lt('next_follow_up_date', now.toISOString());
      if (filterPeriod === 'today') {
        const end = new Date(now); end.setHours(23, 59, 59);
        query = query.gte('next_follow_up_date', now.toISOString()).lte('next_follow_up_date', end.toISOString());
      }
      if (filterPeriod === 'tomorrow') {
        const start = new Date(now); start.setDate(start.getDate() + 1); start.setHours(0,0,0);
        const end = new Date(start); end.setHours(23,59,59);
        query = query.gte('next_follow_up_date', start.toISOString()).lte('next_follow_up_date', end.toISOString());
      }
      if (filterPeriod === 'week') {
        const end = new Date(now); end.setDate(end.getDate() + 7);
        query = query.gte('next_follow_up_date', now.toISOString()).lte('next_follow_up_date', end.toISOString());
      }

      const { data } = await query;
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  const getAgent = (id: string) => profiles.find(p => p.id === id);

  const overdue = callbacks.filter(c => new Date(c.next_follow_up_date!).getTime() < Date.now());
  const upcoming = callbacks.filter(c => new Date(c.next_follow_up_date!).getTime() >= Date.now());

  // Group by agent for admin
  const byAgent = profiles.map(p => ({
    ...p,
    callbacks: callbacks.filter(c => c.assigned_to === p.id),
  })).filter(p => p.callbacks.length > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Callbacks</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Scheduled follow-ups across all agents</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {overdue.length > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {overdue.length} overdue
              </span>
            )}
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              {upcoming.length} upcoming
            </span>
          </div>
        </div>

        {/* Agent stat cards — admin only */}
        {isAdmin && byAgent.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {byAgent.map(agent => {
              const agentOverdue = agent.callbacks.filter(c => new Date(c.next_follow_up_date!).getTime() < Date.now()).length;
              return (
                <Card key={agent.id} className="premium-card cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setFilterAgent(agent.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">{agent.full_name?.charAt(0)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{agent.full_name}</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{agent.callbacks.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {agentOverdue > 0 ? <span className="text-red-400">{agentOverdue} overdue</span> : 'all on time'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          {isAdmin && (
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
            </SelectContent>
          </Select>
          {(filterAgent !== 'all' || filterPeriod !== 'all') && (
            <button onClick={() => { setFilterAgent('all'); setFilterPeriod('all'); }} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded">
              Clear
            </button>
          )}
        </div>

        {/* Callbacks Table */}
        <Card className="premium-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
            ) : callbacks.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No callbacks scheduled</div>
            ) : (
              <div className="divide-y divide-border">
                {/* Overdue first */}
                {overdue.length > 0 && (
                  <div className="px-5 py-2 bg-red-500/5 border-b border-red-500/10">
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Overdue — {overdue.length}</p>
                  </div>
                )}
                {overdue.map(cb => <CallbackRow key={cb.id} cb={cb} agent={getAgent(cb.assigned_to ?? '')} navigate={navigate} isAdmin={isAdmin} />)}

                {/* Upcoming */}
                {upcoming.length > 0 && overdue.length > 0 && (
                  <div className="px-5 py-2 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upcoming — {upcoming.length}</p>
                  </div>
                )}
                {upcoming.map(cb => <CallbackRow key={cb.id} cb={cb} agent={getAgent(cb.assigned_to ?? '')} navigate={navigate} isAdmin={isAdmin} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function CallbackRow({ cb, agent, navigate, isAdmin }: any) {
  const { label, overdue } = timeUntil(cb.next_follow_up_date);
  const dt = new Date(cb.next_follow_up_date);

  return (
    <div
      className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer ${overdue ? 'bg-red-500/5' : ''}`}
      onClick={() => navigate(`/leads/${cb.id}`)}
    >
      {/* Time indicator */}
      <div className={`w-16 shrink-0 text-center`}>
        <p className={`text-xs font-semibold ${overdue ? 'text-red-400' : 'text-primary'}`}>{label}</p>
        <p className="text-[10px] text-muted-foreground">{dt.toLocaleDateString()}</p>
        <p className="text-[10px] text-muted-foreground">{dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </div>

      {/* Lead info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{cb.full_name}</p>
          {cb.country && <span className="text-xs text-muted-foreground">({cb.country})</span>}
        </div>
        {cb.phone && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3" />{cb.phone}
          </p>
        )}
        {cb.callback_note && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">"{cb.callback_note}"</p>
        )}
      </div>

      {/* Agent — admin only */}
      {isAdmin && agent && (
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-primary">{agent.full_name?.charAt(0)}</span>
          </div>
          <span className="text-xs text-muted-foreground">{agent.full_name}</span>
        </div>
      )}

      {/* Status badge */}
      <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${overdue ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
        {overdue ? 'Overdue' : 'Scheduled'}
      </span>
    </div>
  );
}
