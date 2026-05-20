import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, StickyNote, Search } from 'lucide-react';

export default function AgentNotesPage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', content: '' });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['agent-notes', filterAgent],
    queryFn: async () => {
      let query = supabase.from('agent_notes').select('*').order('updated_at', { ascending: false });
      if (!isAdmin) query = query.eq('agent_id', user!.id);
      if (isAdmin && filterAgent !== 'all') query = query.eq('agent_id', filterAgent);
      const { data } = await query;
      return data ?? [];
    },
  });

  const getAgent = (id: string) => profiles.find((p: any) => p.id === id);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from('agent_notes').update({ title: form.title, content: form.content, updated_at: new Date().toISOString() }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('agent_notes').insert({ agent_id: user!.id, title: form.title, content: form.content });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? 'Note updated' : 'Note saved' });
      queryClient.invalidateQueries({ queryKey: ['agent-notes'] });
      setShowForm(false);
      setEditing(null);
      setForm({ title: '', content: '' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agent_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Note deleted' });
      queryClient.invalidateQueries({ queryKey: ['agent-notes'] });
    },
  });

  const filtered = notes.filter((n: any) =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.content?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Notes</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Personal notes — visible to admin</p>
          </div>
          {!isAdmin && (
            <Button onClick={() => { setShowForm(true); setEditing(null); setForm({ title: '', content: '' }); }}>
              <Plus className="w-4 h-4 mr-1.5" /> New Note
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          {isAdmin && (
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {profiles.filter((p: any) => p.role !== 'super_admin').map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* New/Edit note form */}
        {showForm && !isAdmin && (
          <Card className="premium-card border-primary/30">
            <CardContent className="pt-5 space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input placeholder="Note title..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Content</Label>
                <Textarea placeholder="Write your note..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} className="resize-none" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveMutation.mutate()} disabled={!form.title || !form.content || saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : (editing ? 'Update' : 'Save Note')}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-30" />
            {isAdmin ? 'No notes from agents yet' : 'No notes yet — create your first one'}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((note: any) => {
              const agent = getAgent(note.agent_id);
              return (
                <Card key={note.id} className="premium-card hover:border-primary/20 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground text-sm leading-snug">{note.title}</h3>
                      {!isAdmin && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setEditing(note); setForm({ title: note.title, content: note.content }); setShowForm(true); }} className="p-1 hover:text-primary transition-colors">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { if (confirm('Delete this note?')) deleteMutation.mutate(note.id); }} className="p-1 hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {isAdmin && agent && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-primary">{agent.full_name?.charAt(0)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{agent.full_name}</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{note.content}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-3">{new Date(note.updated_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
