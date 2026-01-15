import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Activity, Settings, Trophy } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

// Menu items.
const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: Activity,
  },
  {
    title: "Fútbol",
    url: "/matches",
    icon: Trophy,
  },
  {
    title: "Configuración",
    url: "/profile",
    icon: Settings,
  },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="border-r border-border/50">
      <SidebarContent className="bg-slate-900 text-slate-100">
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-400">LyraTip Command</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    className="hover:bg-slate-800 hover:text-white data-[active=true]:bg-slate-800 data-[active=true]:text-white transition-colors"
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
