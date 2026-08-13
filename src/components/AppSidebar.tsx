import { LayoutDashboard, Users, CheckSquare, Calendar, Settings, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const centralItems: Array<{
  title: string;
  url: string;
  icon: any;
}> = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Tarefas", url: "/tasks", icon: CheckSquare },
  { title: "Calendário", url: "/calendar", icon: Calendar },
];

const configItems = [
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-3">
          {!collapsed && (
            <div>
              <h2 className="text-base font-bold tracking-tight text-sidebar-foreground">
                Vendas CRM
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Painel Operacional</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Central
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {centralItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="rounded-xl transition-all text-sidebar-foreground/70 hover:bg-muted/50 dark:hover:bg-white/[0.04] hover:text-sidebar-accent-foreground"
                      activeClassName="bg-primary/10 text-primary font-semibold border-l-2 border-primary/70"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Configuração
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="rounded-xl transition-all text-sidebar-foreground/70 hover:bg-muted/50 dark:hover:bg-white/[0.04] hover:text-sidebar-accent-foreground"
                      activeClassName="bg-primary/10 text-primary font-semibold border-l-2 border-primary/70"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        {!collapsed && profile && (
          <div className="mb-2 px-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.name}</p>
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={handleSignOut}
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
