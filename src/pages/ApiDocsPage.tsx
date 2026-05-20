import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Copy, Key, Plus, Power, PowerOff, Book, Send, Download } from 'lucide-react';


export default function ApiDocsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPartnerName, setNewPartnerName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['partner-api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: async (partnerName: string) => {
      const { data, error } = await supabase.from('partner_api_keys').insert({
        partner_name: partnerName,
        created_by: user!.id,
        permissions: ['add_lead', 'leads_info'],
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-api-keys'] });
      setNewPartnerName('');
      setShowCreateForm(false);
      toast({ title: 'API key created successfully' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const toggleKeyMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('partner_api_keys').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-api-keys'] });
      toast({ title: 'API key updated' });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Documentation</h1>
          <p className="text-muted-foreground">Share this documentation with partners who need to send you leads</p>
        </div>

        {/* API Key Management */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Partner API Keys
            </CardTitle>
            <CardDescription>Create and manage API keys for external partners</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showCreateForm ? (
              <Button onClick={() => setShowCreateForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Create New API Key
              </Button>
            ) : (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Partner Name</Label>
                  <Input
                    value={newPartnerName}
                    onChange={e => setNewPartnerName(e.target.value)}
                    placeholder="e.g. Acme Marketing"
                  />
                </div>
                <Button onClick={() => createKeyMutation.mutate(newPartnerName)} disabled={!newPartnerName.trim()}>
                  Create Key
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              </div>
            )}

            {apiKeys.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key: any) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.partner_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {key.api_key.slice(0, 8)}...{key.api_key.slice(-4)}
                          </code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(key.api_key)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={key.is_active ? 'default' : 'destructive'}>
                          {key.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(key.permissions || []).map((p: string) => (
                            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleKeyMutation.mutate({ id: key.id, is_active: !key.is_active })}
                        >
                          {key.is_active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-primary" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Lead API Documentation */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Add Lead API
            </CardTitle>
            <CardDescription>Partners use this endpoint to send leads to your CRM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Request URL</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">POST</Badge>
                <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono flex-1">
                  {baseUrl}/receive-lead
                </code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(`${baseUrl}/receive-lead`)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Header</Label>
              <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono block">x-api-key: YOUR_API_KEY</code>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Request Body (JSON)</Label>
              <pre className="text-sm bg-muted px-4 py-3 rounded font-mono overflow-x-auto">{JSON.stringify({
                name: "John Doe",
                email: "test@mail.com",
                phone: "12345678912",
                country: "US",
                language: "EN",
                source: "Test Source",
                source_url: "https://test.com",
                comment: "Comment about new lead"
              }, null, 2)}</pre>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Required Fields</Label>
              <div className="flex gap-2">
                {['name', 'email', 'phone', 'country'].map(f => (
                  <Badge key={f} variant="destructive" className="font-mono text-xs">{f}</Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Responses</Label>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Badge className="bg-primary text-primary-foreground shrink-0">200</Badge>
                  <pre className="text-xs bg-muted px-3 py-2 rounded font-mono flex-1">
{`{ "success": true, "client_id": "uuid" }`}
                  </pre>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="destructive" className="shrink-0">401</Badge>
                  <pre className="text-xs bg-muted px-3 py-2 rounded font-mono flex-1">
{`{ "success": false, "errors": ["Invalid API key"] }`}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads Info API Documentation */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Leads Info API
            </CardTitle>
            <CardDescription>Partners use this endpoint to fetch lead information from your CRM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Request URL</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">POST</Badge>
                <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono flex-1">
                  {baseUrl}/leads-info
                </code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(`${baseUrl}/leads-info`)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Header</Label>
              <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono block">x-api-key: YOUR_API_KEY</code>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Request Body (JSON)</Label>
              <pre className="text-sm bg-muted px-4 py-3 rounded font-mono overflow-x-auto">{JSON.stringify({
                limit: 200,
                offset: 0,
                ftd_date_from: "01-01-2024",
                ftd_date_to: "01-01-2024",
                registration_date_from: "01-01-2024",
                registration_date_to: "01-01-2024"
              }, null, 2)}</pre>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Required</Label>
              <p className="text-sm text-muted-foreground">
                <code className="bg-muted px-1 rounded">limit</code>, <code className="bg-muted px-1 rounded">offset</code> and at least one of <code className="bg-muted px-1 rounded">ftd_date</code> or <code className="bg-muted px-1 rounded">registration_date</code>
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Success Response (200)</Label>
              <pre className="text-sm bg-muted px-4 py-3 rounded font-mono overflow-x-auto">{JSON.stringify({
                success: true,
                clients: [{
                  client_id: "uuid",
                  name: "John Doe",
                  email: "test@mail.com",
                  phone: "12345678912",
                  country: "US",
                  registration_date: "01-01-2024",
                  last_call_status: "interested",
                  is_ftd: true,
                  ftd: 1,
                  ftd_date: "15-01-2024"
                }]
              }, null, 2)}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
