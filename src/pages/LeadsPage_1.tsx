import { useState, useCallback } from 'react';

/** useState that persists to sessionStorage */
function usePersisted(key: string, defaultValue: string): [string, (v: string) => void] {
  const storageKey = `crm-f-${key}`;
  const [value, setValue] = useState(() => sessionStorage.getItem(storageKey) ?? defaultValue);
  const set = useCallback((v: string) => { sessionStorage.setItem(storageKey, v); setValue(v); }, [storageKey]);
  return [value, set];
}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { CopyField, CallButton } from '@/components/CopyField';
import { RetentionBadge, PriorityBadge, TeamBadge, STATUS_OPTIONS, STATUS_LABELS } from '@/components/StatusBadges';
import { InlineStatusSelect } from '@/components/InlineStatusSelect';
import { InlineAgentSelect } from '@/components/InlineAgentSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, UserPlus, ArrowRightLeft, ChevronLeft, ChevronRight, Trash2, Save, BookmarkCheck, X, CheckCircle2, Search } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { Tables } from '@/integrations/supabase/types';
import { detectCountryFromPhone } from '@/lib/phoneCountry';

type Lead = Tables<'leads'>;
type Profile = Tables<'profiles'>;

const PAGE_SIZE_OPTIONS = [20, 30, 50, 100];

export default function LeadsPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filters persisted in sessionStorage via usePersisted
  const [search, setSearch] = usePersisted('search', '');
  const [searchName, setSearchName] = usePersisted('searchName', '');
  const [searchCountry, setSearchCountry] = usePersisted('searchCountry', '');
  const [searchPhone, setSearchPhone] = usePersisted('searchPhone', '');
  const [searchEmail, setSearchEmail] = usePersisted('searchEmail', '');
  const [searchSource, setSearchSource] = usePersisted('searchSource', '');
  const [searchAgent, setSearchAgent] = usePersisted('searchAgent', '');
  const [statusFilter, setStatusFilter] = usePersisted('statusFilter', 'all');
  const [teamFilter, setTeamFilter] = usePersisted('teamFilter', 'all');
  const [sortBy, setSortBy] = usePersisted('sortBy', 'newest');
  const [sourceFilter, setSourceFilter] = usePersisted('sourceFilter', 'all');
  const [agentFilter, setAgentFilter] = usePersisted('agentFilter', 'all');
  const [countryFilter, setCountryFilter] = usePersisted('countryFilter', 'all');
  const [pageSizeStr, setPageSizeStr] = usePersisted('pageSize', '20');
  const pageSize = Number(pageSizeStr);
  const [pageStr, setPageStr] = usePersisted('page', '0');
  const page = Number(pageStr);
  const setPage = (v: number | ((p: number) => number)) => setPageStr(String(typeof v === 'function' ? v(page) : v));
  const [selected, setSelected] = useState<string[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [bulkProgress, setBulkProgress] = useState<{ open: boolean; label: string; done: number; total: number } | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [savedFilters, setSavedFilters] = useState<{ name: string; filters: Record<string, string> }[]>(() => {
    try { return JSON.parse(localStorage.getItem('crm-saved-filters') || '[]'); } catch { return []; }
  });
  const [newLead, setNewLead] = useState<{ full_name: string; phone: string; email: string; country: string; source: string; priority: 'low' | 'medium' | 'high' }>({ full_name: '', phone: '', email: '', country: '', source: '', priority: 'medium' });

  const currentFilters = { statusFilter, teamFilter, sourceFilter, agentFilter, countryFilter, sortBy };

  const saveFilter = () => {
    if (!filterName.trim()) return;
    const updated = [...savedFilters, { name: filterName.trim(), filters: currentFilters }];
    setSavedFilters(updated);
    localStorage.setItem('crm-saved-filters', JSON.stringify(updated));
    setFilterName('');
    setShowSaveFilter(false);
    toast({ title: `Filter "${filterName.trim()}" saved` });
  };

  const loadFilter = (filters: Record<string, string>) => {
    setStatusFilter(filters.statusFilter || 'all');
    setTeamFilter(filters.teamFilter || 'all');
    setSourceFilter(filters.sourceFilter || 'all');
    setAgentFilter(filters.agentFilter || 'all');
    setCountryFilter(filters.countryFilter || 'all');
    setSortBy(filters.sortBy || 'newest');
    setPage(0);
  };

  const deleteFilter = (index: number) => {
    const updated = savedFilters.filter((_, i) => i !== index);
    setSavedFilters(updated);
    localStorage.setItem('crm-saved-filters', JSON.stringify(updated));
  };

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', search, searchName, searchCountry, searchPhone, searchEmail, searchSource, searchAgent, statusFilter, teamFilter, sourceFilter, agentFilter, countryFilter, sortBy, pageSize, page],
    queryFn: async () => {
      let query = supabase.from('leads').select('*');
      if (!isAdmin) query = query.eq('assigned_to', user!.id);
      if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      
      if (searchCountry) query = query.ilike('country', `%${searchCountry}%`);
      if (searchPhone) query = query.ilike('phone', `%${searchPhone}%`);
      if (searchEmail) query = query.ilike('email', `%${searchEmail}%`);
      if (searchSource) query = query.ilike('source', `%${searchSource}%`);
      if (statusFilter !== 'all') query = query.eq('interested_status', statusFilter as any);
      if (teamFilter !== 'all') query = query.eq('team_type', teamFilter as any);
      if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
      if (countryFilter !== 'all') query = query.eq('country', countryFilter);
      if (agentFilter === 'unassigned') query = query.is('assigned_to', null);
      else if (agentFilter !== 'all') query = query.eq('assigned_to', agentFilter);
      if (sortBy === 'newest') query = query.order('created_at', { ascending: false });
      else if (sortBy === 'oldest') query = query.order('created_at', { ascending: true });
      else if (sortBy === 'priority') query = query.order('priority', { ascending: false });
      else if (sortBy === 'follow_up') query = query.order('next_follow_up_date', { ascending: true, nullsFirst: false });
      query = query.range(page * pageSize, (page + 1) * pageSize - 1);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('is_active', true);
      return data ?? [];
    },
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['lead-sources'],
    queryFn: async () => {
      const unique = new Set<string>();
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('leads')
          .select('source')
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        data.forEach(d => { if (d.source) unique.add(d.source as string); });
        if (data.length < PAGE) break;
      }
      unique.add('MLab'); // Always show MLab option (API imports)
      return [...unique].sort();
    },
  });

  const { data: countries = [] } = useQuery({
    queryKey: ['lead-countries'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('country');
      const unique = [...new Set((data ?? []).map(d => d.country).filter(Boolean))] as string[];
      return unique.sort();
    },
  });

  const agents = allProfiles;
  const getAgentName = (id: string | null) => {
    if (!id) return 'Unassigned';
    return allProfiles.find(p => p.id === id)?.full_name ?? 'Unknown';
  };

  // Client-side filter for agent name search
  const filteredLeads = searchAgent
    ? leads.filter(l => getAgentName(l.assigned_to).toLowerCase().includes(searchAgent.toLowerCase()))
    : leads;

  const assignMutation = useMutation({
    mutationFn: async ({ leadIds, agentId }: { leadIds: string[]; agentId: string }) => {
      setShowAssign(false);
      setBulkProgress({ open: true, label: `Assigning to ${getAgentName(agentId)}`, done: 0, total: leadIds.length });
      let done = 0;
      for (const leadId of leadIds) {
        const { data: lead } = await supabase.from('leads').select('assigned_to').eq('id', leadId).single();
        if (lead?.assigned_to !== agentId) {
          await supabase.from('leads').update({ assigned_to: agentId }).eq('id', leadId);
          await supabase.from('lead_assignments').insert({ lead_id: leadId, assigned_by: user!.id, assigned_to: agentId });
          await supabase.from('activity_logs').insert({ user_id: user!.id, action_type: 'assignment', lead_id: leadId, description: `Lead assigned to agent` });
        }
        done++;
        setBulkProgress(p => p ? { ...p, done } : p);
      }
      return { count: leadIds.length, agentId };
    },
    onSuccess: ({ count, agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelected([]);
      setBulkProgress(p => p ? { ...p, done: p.total } : p);
      setTimeout(() => setBulkProgress(null), 1200);
      toast({ title: `${count} lead${count === 1 ? '' : 's'} assigned to ${getAgentName(agentId)}` });
    },
    onError: (err: any) => {
      setBulkProgress(null);
      toast({ title: 'Assignment failed', description: err.message, variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const { error } = await supabase.from('leads').update({ interested_status: status as any }).eq('id', leadId);
      if (error) throw error;
      await supabase.from('activity_logs').insert({ user_id: user!.id, action_type: 'status_change', lead_id: leadId, description: `Status changed to ${status}` });
    },
    onSuccess: (_data, variables) => { queryClient.invalidateQueries({ queryKey: ['leads'] }); queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] }); },
  });

  const inlineAssignMutation = useMutation({
    mutationFn: async ({ leadId, agentId }: { leadId: string; agentId: string }) => {
      const { data: lead } = await supabase.from('leads').select('assigned_to').eq('id', leadId).single();
      if (lead?.assigned_to === agentId) return;
      await supabase.from('leads').update({ assigned_to: agentId }).eq('id', leadId);
      await supabase.from('lead_assignments').insert({ lead_id: leadId, assigned_by: user!.id, assigned_to: agentId });
      await supabase.from('activity_logs').insert({ user_id: user!.id, action_type: 'assignment', lead_id: leadId, description: `Lead assigned to ${getAgentName(agentId)}` });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); },
  });

  const sendToRetentionMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      setBulkProgress({ open: true, label: 'Sending to retention', done: 0, total: leadIds.length });
      let done = 0;
      for (const id of leadIds) {
        await supabase.from('leads').update({ team_type: 'retention', retention_status: 'new_to_retention' }).eq('id', id);
        await supabase.from('activity_logs').insert({ user_id: user!.id, action_type: 'transfer', lead_id: id, description: 'Lead transferred to retention team' });
        done++;
        setBulkProgress(p => p ? { ...p, done } : p);
      }
      return leadIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelected([]);
      setTimeout(() => setBulkProgress(null), 1200);
      toast({ title: `${count} lead${count === 1 ? '' : 's'} sent to retention` });
    },
    onError: (err: any) => { setBulkProgress(null); toast({ title: 'Transfer failed', description: err.message, variant: 'destructive' }); },
  });

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAgent, setTransferAgent] = useState('');

  const transferToAgentMutation = useMutation({
    mutationFn: async ({ leadIds, agentId }: { leadIds: string[]; agentId: string }) => {
      setBulkProgress({ open: true, label: `Transferring to ${getAgentName(agentId)}`, done: 0, total: leadIds.length });
      let done = 0;
      for (const id of leadIds) {
        // Fetch current status
        const { data: lead } = await supabase.from('leads').select('interested_status').eq('id', id).single();
        // Reset status to null only if it was no_answer
        const newStatus = lead?.interested_status === 'no_answer' ? null : lead?.interested_status;
        await supabase.from('leads').update({ assigned_to: agentId, interested_status: newStatus }).eq('id', id);
        await supabase.from('lead_assignments').insert({ lead_id: id, assigned_by: user!.id, assigned_to: agentId });
        await supabase.from('activity_logs').insert({ user_id: user!.id, action_type: 'transfer', lead_id: id, description: `Transferred to ${getAgentName(agentId)}${lead?.interested_status === 'no_answer' ? ' (status reset)' : ''}` });
        done++;
        setBulkProgress(p => p ? { ...p, done } : p);
      }
      return leadIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelected([]);
      setShowTransfer(false);
      setTransferAgent('');
      setTimeout(() => setBulkProgress(null), 1200);
      toast({ title: `${count} lead${count === 1 ? '' : 's'} transferred` });
    },
    onError: (err: any) => { setBulkProgress(null); toast({ title: 'Transfer failed', description: err.message, variant: 'destructive' }); },
  });

  const deleteLeadsMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      setBulkProgress({ open: true, label: 'Deleting leads', done: 0, total: leadIds.length });
      let done = 0;
      for (const id of leadIds) {
        const { error } = await supabase.from('leads').delete().eq('id', id);
        if (error) throw error;
        await supabase.from('activity_logs').insert({ user_id: user!.id, action_type: 'delete', description: `Lead deleted` });
        done++;
        setBulkProgress(p => p ? { ...p, done } : p);
      }
      return leadIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelected([]);
      setTimeout(() => setBulkProgress(null), 1200);
      toast({ title: `${count} lead${count === 1 ? '' : 's'} deleted` });
    },
    onError: (err: any) => { setBulkProgress(null); toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }); },
  });

  const addLeadMutation = useMutation({
    mutationFn: async () => {
      if (newLead.phone) {
        const { data: dup } = await supabase.from('leads').select('id').eq('phone', newLead.phone).limit(1);
        if (dup && dup.length > 0) throw new Error('A lead with this phone number already exists');
      }
      if (newLead.email) {
        const { data: dup } = await supabase.from('leads').select('id').eq('email', newLead.email).limit(1);
        if (dup && dup.length > 0) throw new Error('A lead with this email already exists');
      }
      const { error } = await supabase.from('leads').insert({
        full_name: newLead.full_name, phone: newLead.phone || null, email: newLead.email || null,
        country: newLead.country || null, source: newLead.source || null, priority: newLead.priority as 'low' | 'medium' | 'high',
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setShowAddLead(false); setNewLead({ full_name: '', phone: '', email: '', country: '', source: '', priority: 'medium' }); toast({ title: 'Lead added' }); },
    onError: (err: Error) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const toggleSelect = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => { if (selected.length === filteredLeads.length) setSelected([]); else setSelected(filteredLeads.map(l => l.id)); };

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">{isAdmin ? 'All Leads' : 'My Leads'}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{filteredLeads.length} leads found</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && selected.length > 0 && (
              <>
                <Button variant="outline" size="sm" className="btn-premium" onClick={() => setShowAssign(true)}>
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Assign ({selected.length})
                </Button>
                <Button variant="outline" size="sm" className="btn-premium" onClick={() => setShowTransfer(true)}>
                  <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" /> Transfer ({selected.length})
                </Button>
                <Button variant="outline" size="sm" className="btn-premium" onClick={() => sendToRetentionMutation.mutate(selected)}>
                  <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" /> Retention
                </Button>
                <Button variant="destructive" size="sm" className="btn-premium" onClick={() => { if (confirm(`Delete ${selected.length} lead(s)?`)) deleteLeadsMutation.mutate(selected); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete ({selected.length})
                </Button>
              </>
            )}
            {isAdmin && (
              <Button size="sm" className="btn-premium" onClick={() => setShowAddLead(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Lead
              </Button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="sticky top-14 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="h-9 pl-8 w-52 text-sm rounded-lg" placeholder="Search name, phone, email..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-36 text-sm rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="not_called">Not Called</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={teamFilter} onValueChange={v => { setTeamFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-32 text-sm rounded-lg"><SelectValue placeholder="Team" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="retention">Retention</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={v => { setSourceFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-36 text-sm rounded-lg"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={agentFilter} onValueChange={v => { setAgentFilter(v); setPage(0); }}>
                <SelectTrigger className="h-9 w-36 text-sm rounded-lg"><SelectValue placeholder="Agent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {allProfiles.filter(p => p.role !== 'super_admin').map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={countryFilter} onValueChange={v => { setCountryFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-32 text-sm rounded-lg"><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-36 text-sm rounded-lg"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="follow_up">Follow-up Date</SelectItem>
              </SelectContent>
            </Select>
            {(statusFilter !== 'all' || teamFilter !== 'all' || sourceFilter !== 'all' || agentFilter !== 'all' || countryFilter !== 'all' || searchName || search) && (
              <button onClick={() => { setStatusFilter('all'); setTeamFilter('all'); setSourceFilter('all'); setAgentFilter('all'); setCountryFilter('all'); setSearchName(''); setSearch(''); setPage(0); }} className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg flex items-center gap-1">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Select value={String(pageSize)} onValueChange={v => { setPageSizeStr(v); setPage(0); }}>
                <SelectTrigger className="w-24 h-9 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>{PAGE_SIZE_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}</SelectContent>
              </Select>
              {savedFilters.length > 0 && (
                <Select onValueChange={(v) => loadFilter(savedFilters[Number(v)].filters)}>
                  <SelectTrigger className="w-36 h-9 text-sm rounded-lg"><SelectValue placeholder="Saved filters" /></SelectTrigger>
                  <SelectContent>
                    {savedFilters.map((f, i) => (
                      <div key={i} className="flex items-center justify-between pr-1">
                        <SelectItem value={String(i)} className="flex-1">{f.name}</SelectItem>
                        <button className="p-1 hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); deleteFilter(i); }}><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {showSaveFilter ? (
                <div className="flex items-center gap-1">
                  <Input className="h-9 w-32 text-sm rounded-lg" placeholder="Filter name..." value={filterName} onChange={e => setFilterName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveFilter()} autoFocus />
                  <Button size="sm" variant="default" className="h-9 w-9 p-0 rounded-lg" onClick={saveFilter}><Save className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-lg" onClick={() => setShowSaveFilter(false)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-9 text-sm rounded-lg" onClick={() => setShowSaveFilter(true)}>
                  <BookmarkCheck className="h-3.5 w-3.5 mr-1" /> Save
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="premium-card overflow-hidden rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
                {isAdmin && <TableHead className="w-10 pl-4"><Checkbox checked={selected.length === filteredLeads.length && filteredLeads.length > 0} onCheckedChange={toggleAll} /></TableHead>}
                <TableHead className="table-header">Name</TableHead>
                <TableHead className="table-header">Country</TableHead>
                <TableHead className="table-header">Phone</TableHead>
                <TableHead className="table-header w-12 text-center">C2C</TableHead>
                <TableHead className="table-header">Email</TableHead>
                <TableHead className="table-header">Team</TableHead>
                <TableHead className="table-header">Status</TableHead>
                <TableHead className="table-header">Priority</TableHead>
                <TableHead className="table-header">Assigned To</TableHead>
                {isAdmin && <TableHead className="table-header">Source</TableHead>}
                <TableHead className="table-header text-right pr-4">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={12} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-12 text-muted-foreground">No leads found</TableCell></TableRow>
              ) : (
                filteredLeads.map((lead: any) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors h-11"
                    onClick={() => navigate(`/leads/${lead.id}`, { state: { leadIds: filteredLeads.map(l => l.id) } })}
                  >
                    {isAdmin && (
                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.includes(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-foreground text-sm">{lead.full_name}</TableCell>
                    <TableCell className="text-sm">
                      {(() => {
                        const detected = detectCountryFromPhone(lead.phone);
                        const code = lead.country?.toUpperCase() || detected?.code || null;
                        if (!code) return <span className="text-muted-foreground">—</span>;
                        return <span>{code}</span>;
                      })()}
                    </TableCell>
                    <TableCell className="text-sm">{lead.phone ? <CopyField value={lead.phone} type="phone" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>{lead.phone ? <CallButton phone={lead.phone} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{lead.email ? <CopyField value={lead.email} type="email" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><TeamBadge team={lead.team_type} /></TableCell>
                    <TableCell>
                      {lead.team_type === 'retention' ? (
                        <RetentionBadge status={lead.retention_status} />
                      ) : (
                        <InlineStatusSelect value={lead.interested_status} onValueChange={(s) => updateStatusMutation.mutate({ leadId: lead.id, status: s })} />
                      )}
                    </TableCell>
                    <TableCell><PriorityBadge priority={lead.priority} /></TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <InlineAgentSelect value={lead.assigned_to} agents={allProfiles} onValueChange={(agentId) => inlineAssignMutation.mutate({ leadId: lead.id, agentId })} />
                      ) : (
                        <span className="text-sm text-muted-foreground">{getAgentName(lead.assigned_to)}</span>
                      )}
                    </TableCell>
                    {isAdmin && <TableCell className="text-sm text-muted-foreground">{lead.source ?? '—'}</TableCell>}
                    <TableCell className="text-sm text-muted-foreground text-right pr-4">{new Date(lead.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center pt-1">
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={leads.length < pageSize} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* Transfer to Agent Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer {selected.length} Lead{selected.length !== 1 ? 's' : ''} to Agent</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Leads with <span className="font-medium text-foreground">No Answer</span> status will be reset to <span className="font-medium text-foreground">Not Set</span>. All other statuses stay unchanged.
            </p>
            <div className="space-y-2">
              <Label>Transfer to</Label>
              <Select value={transferAgent} onValueChange={setTransferAgent}>
                <SelectTrigger><SelectValue placeholder="Select agent..." /></SelectTrigger>
                <SelectContent>
                  {allProfiles.filter(p => p.role !== 'super_admin').map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name} ({a.team})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransfer(false)}>Cancel</Button>
            <Button disabled={!transferAgent || transferToAgentMutation.isPending} onClick={() => transferToAgentMutation.mutate({ leadIds: selected, agentId: transferAgent })}>
              {transferToAgentMutation.isPending ? 'Transferring...' : 'Transfer Leads'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Leads</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{selected.length} lead(s) selected</p>
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name} ({a.team})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button className="btn-premium" onClick={() => assignMutation.mutate({ leadIds: selected, agentId: assignTo })} disabled={!assignTo}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lead Dialog */}
      <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label className="text-xs text-muted-foreground mb-1.5 block">Full Name *</Label><Input value={newLead.full_name} onChange={e => setNewLead(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Phone</Label><Input value={newLead.phone} onChange={e => { const phone = e.target.value; const detected = detectCountryFromPhone(phone); setNewLead(p => ({ ...p, phone, country: detected?.code || p.country })); }} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Email</Label><Input value={newLead.email} onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Country</Label><Input value={newLead.country} onChange={e => setNewLead(p => ({ ...p, country: e.target.value }))} placeholder="Auto-detected" /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Source</Label><Input value={newLead.source} onChange={e => setNewLead(p => ({ ...p, source: e.target.value }))} /></div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Priority</Label>
              <Select value={newLead.priority} onValueChange={v => setNewLead(p => ({ ...p, priority: v as 'low' | 'medium' | 'high' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLead(false)}>Cancel</Button>
            <Button className="btn-premium" onClick={() => addLeadMutation.mutate()} disabled={!newLead.full_name}>Add Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Progress Dialog */}
      <Dialog open={!!bulkProgress?.open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkProgress && bulkProgress.done >= bulkProgress.total ? (
                <><CheckCircle2 className="h-5 w-5 text-primary" /> Done</>
              ) : (
                <>{bulkProgress?.label ?? 'Processing'}</>
              )}
            </DialogTitle>
          </DialogHeader>
          {bulkProgress && (
            <div className="space-y-3 py-2">
              <Progress value={(bulkProgress.done / Math.max(bulkProgress.total, 1)) * 100} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {bulkProgress.done} / {bulkProgress.total}
                </span>
                <span className="text-foreground font-medium tabular-nums">
                  {Math.round((bulkProgress.done / Math.max(bulkProgress.total, 1)) * 100)}%
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
