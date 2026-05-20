import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus, TrendingUp, Clock, CheckCircle, XCircle, Activity, ArrowRightLeft } from 'lucide-react';

function StatCard({ title, value, icon: Icon, className }: { title: string; value: string | number; icon: React.ElementType; className?: string }) {
  return (
    <Card className="premium-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-semibold text-foreground mt-1.5 tabular-nums">{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${className ?? 'bg-primary/10 text-primary'}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  const { data: leads } = useQuery({
    queryKey: ['dashboard-leads'],
    queryFn: async () => {
      // Fetch all leads in pages of 1000 to bypass PostgREST default cap
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const total = leads?.length ?? 0;
  // Use LOCAL date boundaries instead of UTC so "today" matches the user's clock
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const newToday = leads?.filter(l => new Date(l.created_at) >= startOfToday).length ?? 0;
  const inSales = leads?.filter(l => l.team_type === 'sales').length ?? 0;
  const inRetention = leads?.filter(l => l.team_type === 'retention').length ?? 0;
  const interested = leads?.filter(l => l.interested_status === 'interested').length ?? 0;
  const converted = leads?.filter(l => l.interested_status === 'converted' || l.retention_status === 'deposited_converted').length ?? 0;
  const lost = leads?.filter(l => l.retention_status === 'lost').length ?? 0;
  const unassigned = leads?.filter(l => !l.assigned_to).length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of your CRM performance</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Leads" value={total} icon={Users} />
          <StatCard title="New Today" value={newToday} icon={UserPlus} className="bg-success/10 text-success" />
          <StatCard title="In Sales" value={inSales} icon={TrendingUp} className="bg-info/10 text-info" />
          <StatCard title="In Retention" value={inRetention} icon={ArrowRightLeft} className="bg-warning/10 text-warning" />
          <StatCard title="Interested" value={interested} icon={CheckCircle} className="bg-success/10 text-success" />
          <StatCard title="Converted" value={converted} icon={TrendingUp} className="bg-primary/10 text-primary" />
          <StatCard title="Lost" value={lost} icon={XCircle} className="bg-destructive/10 text-destructive" />
          <StatCard title="Unassigned" value={unassigned} icon={Clock} className="bg-muted text-muted-foreground" />
        </div>
        <Card className="premium-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 text-sm border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div>
                      <p className="text-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(activity.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function AgentDashboard() {
  const { user } = useAuth();

  const { data: myLeads } = useQuery({
    queryKey: ['my-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*').eq('assigned_to', user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const total = myLeads?.length ?? 0;
  const today = new Date().toISOString().split('T')[0];
  const followUpsToday = myLeads?.filter(l => l.next_follow_up_date?.startsWith(today)).length ?? 0;
  const interested = myLeads?.filter(l => l.interested_status === 'interested').length ?? 0;
  const callbacks = myLeads?.filter(l => l.interested_status === 'callback_later').length ?? 0;
  const converted = myLeads?.filter(l => l.interested_status === 'converted' || l.retention_status === 'deposited_converted').length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">My Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your leads and tasks overview</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="My Leads" value={total} icon={Users} />
          <StatCard title="Follow-ups Today" value={followUpsToday} icon={Clock} className="bg-warning/10 text-warning" />
          <StatCard title="Interested" value={interested} icon={CheckCircle} className="bg-success/10 text-success" />
          <StatCard title="Callbacks" value={callbacks} icon={Activity} className="bg-info/10 text-info" />
          <StatCard title="Converted" value={converted} icon={TrendingUp} className="bg-primary/10 text-primary" />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <AgentDashboard />;
}
