import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { CopyField } from '@/components/CopyField';
import { StatusBadge, RetentionBadge, PriorityBadge, TeamBadge, STATUS_OPTIONS, STATUS_LABELS } from '@/components/StatusBadges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Clock, User, MessageSquare, ArrowRightLeft, Calendar } from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const location = useLocation();
  const stateLeadIds: string[] | undefined = (location.state as any)?.leadIds;

  const { data: allLeadIds = [] } = useQuery({
    queryKey: ['lead-ids-nav'],
    queryFn: async () => {
      let query = supabase.from('leads').select('id').order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('assigned_to', user!.id);
      const { data } = await query;
      return (data ?? []).map(l => l.id);
    },
    enabled: !stateLeadIds,
  });

  const leadIds = stateLeadIds ?? allLeadIds;

  const { data: notes = [] } = useQuery({
    queryKey: ['lead-notes', id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_notes').select('*').eq('lead_id', id!).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['lead-assignments', id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_assignments').select('*').eq('lead_id', id!).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('is_active', true);
      return data ?? [];
    },
  });

  const getAgentName = (id: string | null) => {
    if (!id) return 'Unassigned';
    return agents.find(p => p.id === id)?.full_name ?? 'Unknown';
  };

  const updateLeadMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from('leads').update(updates as any).eq('id', id!);
      if (error) throw error;
      await supabase.from('activity_logs').insert({ user_id: user!.id, action_type: 'update', lead_id: id!, description: `Updated ${Object.keys(updates).join(', ')} for ${lead?.full_name ?? 'lead'}` });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lead', id] }); queryClient.invalidateQueries({ queryKey: ['leads'] }); toast({ title: 'Lead updated' }); },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('lead_notes').insert({ lead_id: id!, author_id: user!.id, author_team: profile!.team, note_text: newNote });
      if (error) throw error;
      await supabase.from('activity_logs').insert({ user_id: user!.id, action_type: 'note', lead_id: id!, description: `Added a note on ${lead?.full_name ?? 'lead'}` });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lead-notes', id] }); setNewNote(''); toast({ title: 'Note added' }); },
  });

  const sendToRetentionMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('leads').update({ team_type: 'retention', retention_status: 'new_to_retention' }).eq('id', id!);
      await supabase.from('activity_logs').insert({ user_id: user!.id, action_type: 'transfer', lead_id: id!, description: `Transferred ${lead?.full_name ?? 'lead'} to retention` });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lead', id] }); toast({ title: 'Lead sent to retention' }); },
  });

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div></DashboardLayout>;
  if (!lead) return <DashboardLayout><div className="flex items-center justify-center py-20 text-muted-foreground">Lead not found</div></DashboardLayout>;

  const idx = leadIds.indexOf(id!);
  const prevId = idx > 0 ? leadIds[idx - 1] : null;
  const nextId = idx >= 0 && idx < leadIds.length - 1 ? leadIds[idx + 1] : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Top Nav */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/leads')} className="text-muted-foreground hover:text-foreground -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" disabled={!prevId} onClick={() => prevId && navigate(`/leads/${prevId}`)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">{idx >= 0 ? `${idx + 1} / ${leadIds.length}` : ''}</span>
            <Button variant="outline" size="sm" className="h-8" disabled={!nextId} onClick={() => nextId && navigate(`/leads/${nextId}`)}>
              Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>

        {/* Lead Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">{lead.full_name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <TeamBadge team={lead.team_type} />
              <StatusBadge status={lead.interested_status} />
              {lead.retention_status && <RetentionBadge status={lead.retention_status} />}
              <PriorityBadge priority={lead.priority} />
            </div>
          </div>
        </div>

        {/* Two-column layout: Left 70% / Right 30% */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-5">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-7 space-y-5">
            {/* Lead Info Card */}
            <Card className="premium-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Lead Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <div className="mt-1.5">{lead.phone ? <CopyField value={lead.phone} type="phone" /> : <span className="text-muted-foreground text-sm">—</span>}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="mt-1.5">{lead.email ? <CopyField value={lead.email} type="email" /> : <span className="text-muted-foreground text-sm">—</span>}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Country</Label>
                    <p className="mt-1.5 text-sm text-foreground">{lead.country ?? '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Source</Label>
                    <p className="mt-1.5 text-sm text-foreground">{lead.source ?? '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Assigned To</Label>
                    <p className="mt-1.5 text-sm text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" /> {getAgentName(lead.assigned_to)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Added</Label>
                    <p className="mt-1.5 text-sm text-foreground">{new Date(lead.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <Separator />

                {/* Status / Priority / Follow-up */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Interested Status</Label>
                    <Select value={lead.interested_status ?? undefined} onValueChange={v => updateLeadMutation.mutate({ interested_status: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {lead.team_type === 'retention' && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Retention Status</Label>
                      <Select value={lead.retention_status ?? undefined} onValueChange={v => updateLeadMutation.mutate({ retention_status: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{Constants.public.Enums.retention_status.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Priority</Label>
                    <Select value={lead.priority ?? undefined} onValueChange={v => updateLeadMutation.mutate({ priority: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">📅 Callback Date & Time</Label>
                    <Input
                      type="datetime-local"
                      className="h-9"
                      value={lead.next_follow_up_date ? new Date(lead.next_follow_up_date).toISOString().slice(0,16) : ''}
                      onChange={e => updateLeadMutation.mutate({ next_follow_up_date: e.target.value || null })}
                    />
                    {lead.next_follow_up_date && (
                      <p className={`text-xs mt-1 ${new Date(lead.next_follow_up_date) < new Date() ? 'text-red-400' : 'text-primary'}`}>
                        {new Date(lead.next_follow_up_date) < new Date() ? '⚠️ Overdue' : `⏰ ${new Date(lead.next_follow_up_date).toLocaleString()}`}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Callback Note</Label>
                    <Input
                      placeholder="What to discuss on callback..."
                      className="h-9"
                      defaultValue={(lead as any).callback_note ?? ''}
                      onBlur={e => { if (e.target.value !== ((lead as any).callback_note ?? '')) updateLeadMutation.mutate({ callback_note: e.target.value || null }); }}
                    />
                  </div>
                  {isAdmin && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Assign To</Label>
                      <Select value={lead.assigned_to ?? undefined} onValueChange={v => {
                        if (v !== lead.assigned_to) {
                          updateLeadMutation.mutate({ assigned_to: v });
                          supabase.from('lead_assignments').insert({ lead_id: id!, assigned_by: user!.id, assigned_to: v });
                        }
                      }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select agent" /></SelectTrigger>
                        <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name} ({a.team})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Notes Card */}
            <Card className="premium-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Textarea placeholder="Add a note..." value={newNote} onChange={e => setNewNote(e.target.value)} className="flex-1 min-h-[80px] resize-none" />
                  <Button onClick={() => addNoteMutation.mutate()} disabled={!newNote.trim()} className="self-end btn-premium">Add</Button>
                </div>
                {notes.length > 0 && <Separator />}
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No notes yet</p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note: any) => (
                      <div key={note.id} className="border border-border rounded-lg p-4 bg-muted/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground">{getAgentName(note.author_id)}</span>
                            <TeamBadge team={note.author_team} />
                          </div>
                          <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{note.note_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-3 space-y-5">
            {/* Actions Card */}
            {isAdmin && lead.team_type === 'sales' && (
              <Card className="premium-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full btn-premium" onClick={() => sendToRetentionMutation.mutate()}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" /> Send to Retention
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* History Card */}
            <Card className="premium-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No assignment history</p>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((a: any) => (
                      <div key={a.id} className="text-sm border-b border-border pb-3 last:border-0 last:pb-0">
                        <p className="text-foreground">
                          <span className="font-medium">{getAgentName(a.assigned_by)}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-medium">{getAgentName(a.assigned_to)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
