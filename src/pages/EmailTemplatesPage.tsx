import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Copy, Plus, Trash2, Edit, Mail, Check, Search } from 'lucide-react';

const CATEGORIES = ['general', 'outreach', 'follow-up', 'portal', 'update', 'retention'];

export default function EmailTemplatesPage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', subject: '', body: '', category: 'general' });

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('email_templates').select('*').order('category').order('title');
      return data ?? [];
    },
  });

  const filtered = templates.filter((t: any) => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase()) || t.body?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || t.category === filterCat;
    return matchSearch && matchCat;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from('email_templates').update({ title: form.title, subject: form.subject, body: form.body, category: form.category }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('email_templates').insert({ ...form, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? 'Template updated' : 'Template created' });
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setShowForm(false);
      setEditing(null);
      setForm({ title: '', subject: '', body: '', category: 'general' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Template deleted' });
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
  });

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast({ title: 'Copied to clipboard!' });
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Templates</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Copy and paste into your emails</p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setShowForm(true); setEditing(null); setForm({ title: '', subject: '', body: '', category: 'general' }); }}>
              <Plus className="w-4 h-4 mr-1.5" /> New Template
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm w-56" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`h-9 px-3 text-sm rounded-lg border transition-colors capitalize ${filterCat === cat ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        {showForm && isAdmin && (
          <Card className="premium-card border-primary/30">
            <CardContent className="pt-5 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Template Title</Label>
                  <Input placeholder="e.g. Initial Outreach" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email Subject (optional)</Label>
                <Input placeholder="Subject line..." value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email Body</Label>
                <Textarea placeholder="Write the template body... Use [Client Name], [Agent Name] as placeholders" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={8} className="resize-none font-mono text-sm" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveMutation.mutate()} disabled={!form.title || !form.body || saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : (editing ? 'Update' : 'Create Template')}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Templates */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No templates found
            </div>
          ) : (
            filtered.map((t: any) => (
              <Card key={t.id} className="premium-card hover:border-primary/20 transition-colors">
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-foreground">{t.title}</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-muted border border-border rounded-full text-muted-foreground capitalize">{t.category}</span>
                    </div>
                    <div className="flex gap-2">
                      {isAdmin && (
                        <>
                          <button onClick={() => { setEditing(t); setForm({ title: t.title, subject: t.subject ?? '', body: t.body, category: t.category }); setShowForm(true); }} className="p-1.5 hover:text-primary transition-colors">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { if (confirm('Delete template?')) deleteMutation.mutate(t.id); }} className="p-1.5 hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {t.subject && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Subject:</span>
                      <span className="text-xs text-foreground">{t.subject}</span>
                      <button onClick={() => copyToClipboard(t.subject, `subject-${t.id}`)} className="p-0.5 hover:text-primary transition-colors">
                        {copied === `subject-${t.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed bg-muted/30 rounded-lg p-4 border border-border">{t.body}</pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-1.5"
                    onClick={() => copyToClipboard(t.body, t.id)}
                  >
                    {copied === t.id ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Email Body</>}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
