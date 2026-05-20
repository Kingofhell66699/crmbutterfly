import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-6 gap-3 bg-card/80 backdrop-blur-sm shrink-0 sticky top-0 z-30">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0" />
            <div className="flex-1" />
            <div className="flex items-center gap-3 ml-auto shrink-0">
              <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
                <Bell className="h-4 w-4" />
              </Button>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                {profile?.full_name?.charAt(0) ?? '?'}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
