import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';

const today = new Date().toISOString().split('T')[0];

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function StandupPage() {
  const { user, profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('is_active', true);
      return data ?? [];
    },
    enabled: isAdmin,
  });

  // Today's standup for current agent
  const { data: myStandup } = useQuery({
    queryKey: ['my-standup', today],
    queryFn: async () => {
      const { data } = await supabase.from('daily_standups').select('*').eq('agent_id', user!.id).eq('date', today).maybeSingle();
      return data;
    },
  });

  // All standups for admin
  const { data: allStandups = [] } = useQuery({
    queryKey: ['all-standups'],
    queryFn: async () => {
      const { data } = await supabase.from('daily_standups').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(100);
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const [form, setForm] = useState({ did_today: '', doing_tomorrow: '', blockers: '' });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('daily_standups').upsert({
        agent_id: user!.id,
        date: today,
        did_today: form.did_today,
        doing_tomorrow: form.doing_tomorrow,
        blockers: form.blockers || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agent_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Standup submitted ✅' });
      queryClient.invalidateQueries({ queryKey: ['my-standup'] });
      queryClient.invalidateQueries({ queryKey: ['all-standups'] });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const getAgent = (id: string) => profiles.find(p => p.id === id);

  // Group standups by date for admin
  const byDate = allStandups.reduce((acc: any, s: any) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  // Check which agents haven't submitted today
  const agentsWithoutStandup = isAdmin
    ? profiles.filter(p => p.role !== 'super_admin' && !allStandups.find((s: any) => s.agent_id === p.id && s.date === today))
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Standup</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{formatDate(today)}</p>
        </div>

        {/* Agent — submit standup */}
        {!isAdmin && (
          <Card className="premium-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {myStandup ? (
                  <><CheckCircle className="w-4 h-4 text-emerald-500" /> Today's standup submitted</>
                ) : (
                  <><AlertCircle className="w-4 h-4 text-amber-500" /> Submit today's standup</>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {myStandup ? (
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">What I did today</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{myStandup.did_today}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">What I'm doing tomorrow</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{myStandup.doing_tomorrow}</p>
                  </div>
                  {myStandup.blockers && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Blockers</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{myStandup.blockers}</p>
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setForm({ did_today: myStandup.did_today, doing_tomorrow: myStandup.doing_tomorrow, blockers: myStandup.blockers ?? '' })}>
                    Edit
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">✅ What did you do today?</Label>
                    <Textarea placeholder="Describe what you worked on today — leads called, follow-ups done, deals closed..." value={form.did_today} onChange={e => setForm(f => ({ ...f, did_today: e.target.value }))} rows={3} className="resize-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">📋 What will you do tomorrow?</Label>
                    <Textarea placeholder="What are your priorities for tomorrow? Callbacks scheduled, leads to follow up..." value={form.doing_tomorrow} onChange={e => setForm(f => ({ ...f, doing_tomorrow: e.target.value }))} rows={3} className="resize-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">⚠️ Any blockers? (optional)</Label>
                    <Textarea placeholder="Anything blocking your work? Issues, questions for admin..." value={form.blockers} onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))} rows={2} className="resize-none" />
                  </div>
                  <Button onClick={() => submitMutation.mutate()} disabled={!form.did_today || !form.doing_tomorrow || submitMutation.isPending} className="w-full">
                    {submitMutation.isPending ? 'Submitting...' : 'Submit Standup'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin — see all standups */}
        {isAdmin && (
          <>
            {/* Missing standups warning */}
            {agentsWithoutStandup.length > 0 && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-400">Missing today's standup</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{agentsWithoutStandup.map(a => a.full_name).join(', ')}</p>
                </div>
              </div>
            )}

            {/* Standups by date */}
            {Object.entries(byDate).map(([date, standups]: [string, any]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">{formatDate(date)}</h3>
                  {date === today && <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">Today</span>}
                </div>
                <div className="space-y-3">
                  {standups.map((s: any) => {
                    const agent = getAgent(s.agent_id);
                    const isOpen = expanded === s.id;
                    return (
                      <Card key={s.id} className="premium-card">
                        <button className="w-full text-left" onClick={() => setExpanded(isOpen ? null : s.id)}>
                          <CardHeader className="pb-2 pt-4 px-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-xs font-semibold text-primary">{agent?.full_name?.charAt(0)}</span>
                                </div>
                                <span className="font-medium text-foreground text-sm">{agent?.full_name}</span>
                                <span className="text-xs text-muted-foreground capitalize">{agent?.role?.replace('_', ' ')}</span>
                                {s.blockers && <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full">Has blocker</span>}
                              </div>
                              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </div>
                            {!isOpen && <p className="text-xs text-muted-foreground mt-1 line-clamp-1 ml-9">{s.did_today}</p>}
                          </CardHeader>
                        </button>
                        {isOpen && (
                          <CardContent className="px-5 pb-5 space-y-3">
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">✅ What they did</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{s.did_today}</p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">📋 Tomorrow's plan</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{s.doing_tomorrow}</p>
                            </div>
                            {s.blockers && (
                              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                                <p className="text-xs uppercase tracking-wider text-red-400 mb-1">⚠️ Blocker</p>
                                <p className="text-sm text-foreground whitespace-pre-wrap">{s.blockers}</p>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
            {Object.keys(byDate).length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No standups submitted yet</div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
