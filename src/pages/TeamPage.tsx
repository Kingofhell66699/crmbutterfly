import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Edit, Shield, KeyRound } from 'lucide-react';

export default function TeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', role: 'sales_agent' as const, team: 'sales' as const });
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ role: '', team: '' });
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const { data: members = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: leadCounts = {} } = useQuery({
    queryKey: ['team-lead-counts'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('assigned_to');
      const counts: Record<string, number> = {};
      (data ?? []).forEach(l => {
        if (l.assigned_to) counts[l.assigned_to] = (counts[l.assigned_to] || 0) + 1;
      });
      return counts;
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: { data: { full_name: newUser.full_name } },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').update({ role: newUser.role, team: newUser.team }).eq('id', data.user.id);
        await supabase.from('user_roles').insert({ user_id: data.user.id, role: newUser.role });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setShowCreate(false);
      setNewUser({ full_name: '', email: '', password: '', role: 'sales_agent', team: 'sales' });
      toast({ title: 'User created successfully' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editUserId) return;
      await supabase.from('profiles').update({
        role: editData.role as any,
        team: editData.team as any,
      }).eq('id', editUserId);
      // Update role in user_roles
      await supabase.from('user_roles').delete().eq('user_id', editUserId);
      await supabase.from('user_roles').insert({ user_id: editUserId, role: editData.role as any });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setEditUserId(null);
      toast({ title: 'User updated' });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!passwordUserId || !newPassword) return;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ user_id: passwordUserId, new_password: newPassword }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to change password');
    },
    onSuccess: () => {
      setPasswordUserId(null);
      setNewPassword('');
      toast({ title: 'Password changed successfully' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
            <p className="text-muted-foreground">{members.length} team members</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Add User
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">Name</TableHead>
                  <TableHead className="table-header">Email</TableHead>
                  <TableHead className="table-header">Role</TableHead>
                  <TableHead className="table-header">Team</TableHead>
                  <TableHead className="table-header">Status</TableHead>
                  <TableHead className="table-header">Leads</TableHead>
                  <TableHead className="table-header">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-foreground">{m.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant={m.role === 'super_admin' ? 'default' : 'secondary'} className="capitalize">
                        {m.role === 'super_admin' && <Shield className="h-3 w-3 mr-1" />}
                        {m.role.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{m.team}</TableCell>
                    <TableCell>
                      <span className={`status-badge ${m.is_active ? 'status-active' : 'status-lost'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{leadCounts[m.id] || 0}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditUserId(m.id);
                          setEditData({ role: m.role, team: m.team });
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setPasswordUserId(m.id); setNewPassword(''); }}
                        title="Change password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name</Label><Input value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Password</Label><Input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} /></div>
            <div>
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={v => setNewUser(p => ({ ...p, role: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="sales_agent">Sales Agent</SelectItem>
                  <SelectItem value="retention_agent">Retention Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team</Label>
              <Select value={newUser.team} onValueChange={v => setNewUser(p => ({ ...p, team: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="retention">Retention</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createUserMutation.mutate()} disabled={!newUser.full_name || !newUser.email || !newUser.password}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUserId} onOpenChange={() => setEditUserId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Role</Label>
              <Select value={editData.role} onValueChange={v => setEditData(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="sales_agent">Sales Agent</SelectItem>
                  <SelectItem value="retention_agent">Retention Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team</Label>
              <Select value={editData.team} onValueChange={v => setEditData(p => ({ ...p, team: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="retention">Retention</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserId(null)}>Cancel</Button>
            <Button onClick={() => updateUserMutation.mutate()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Change Password Dialog */}
      <Dialog open={!!passwordUserId} onOpenChange={() => setPasswordUserId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set a new password for <span className="font-medium text-foreground">{members.find(m => m.id === passwordUserId)?.full_name}</span>
            </p>
            <div>
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordUserId(null)}>Cancel</Button>
            <Button onClick={() => changePasswordMutation.mutate()} disabled={newPassword.length < 6}>
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
