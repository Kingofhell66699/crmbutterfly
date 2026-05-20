import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCog, FileUp, ClipboardList,
  Settings, LogOut, Activity, ChevronLeft, Book, Phone, Sun, Moon,
  ClipboardCheck, StickyNote, Mail,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const adminItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Leads', url: '/leads', icon: ClipboardList },
  { title: 'Callbacks', url: '/callbacks', icon: Phone },
  { title: 'Daily Standups', url: '/standup', icon: ClipboardCheck },
  { title: 'Agent Notes', url: '/notes', icon: StickyNote },
  { title: 'Email Templates', url: '/templates', icon: Mail },
  { title: 'Activity Log', url: '/activity', icon: Activity },
  { title: 'Import Center', url: '/import', icon: FileUp },
  { title: 'Team Management', url: '/team', icon: UserCog },
  { title: 'API Docs', url: '/api-docs', icon: Book },
  { title: 'Settings', url: '/settings', icon: Settings },
];

const agentItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'My Leads', url: '/leads', icon: ClipboardList },
  { title: 'Callbacks', url: '/callbacks', icon: Phone },
  { title: 'Daily Standup', url: '/standup', icon: ClipboardCheck },
  { title: 'My Notes', url: '/notes', icon: StickyNote },
  { title: 'Email Templates', url: '/templates', icon: Mail },
  { title: 'Activity', url: '/activity', icon: Activity },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { profile, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const items = isAdmin ? adminItems : agentItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between px-3 py-4">
            {!collapsed && (
              <span className="text-sidebar-primary font-bold text-lg tracking-tight">NexusCRM</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-7 w-7 text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
            >
              <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && profile && (
          <div className="mb-2 px-1">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{profile.full_name}</p>
            <p className="text-xs text-sidebar-foreground truncate capitalize">{profile.role.replace('_', ' ')}</p>
          </div>
        )}
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          onClick={toggleTheme}
          className="w-full text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent justify-start"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span className="ml-2">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </Button>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          onClick={signOut}
          className="w-full text-sidebar-foreground hover:text-destructive hover:bg-sidebar-accent justify-start"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
