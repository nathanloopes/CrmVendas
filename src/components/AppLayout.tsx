import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { TaskAlertSystem } from "@/components/TaskAlertSystem";
import { NotificationBell } from "@/components/NotificationBell";
import { RealtimeSync } from "@/components/RealtimeSync";
import { StaleLeadAlertSystem } from "@/components/StaleLeadAlertSystem";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoImg from "@/assets/logo.png";

export default function AppLayout() {
  const { profile } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          <header className="h-14 flex items-center bg-card px-4 gap-4 shadow-sm border-b border-border/50">
            <SidebarTrigger />
            <img src={logoImg} alt="Logo" className="w-6 h-6 object-contain" />
            <div className="flex-1" />
            <ThemeToggle />
            <NotificationBell />
            {profile && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </header>

          <main className="flex-1 overflow-hidden p-6 flex flex-col min-w-0 bg-muted/30">
            <Outlet />
          </main>
        </div>
      </div>
      <TaskAlertSystem />
      <StaleLeadAlertSystem />
      <RealtimeSync />
    </SidebarProvider>
  );
}
