import { LayoutDashboard, FileText, MessageSquare, Code2, Brain, Moon, Sun, Settings2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Agent Config", url: "/settings", icon: Settings2 },
  { title: "Agent Visualizer", url: "/agent", icon: Brain },
  { title: "API Explorer", url: "/api", icon: Code2 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className={cn(
        "flex items-center border-b border-sidebar-border transition-all duration-200",
        collapsed ? "justify-center h-[73px]" : "gap-3 px-4 py-5"
      )}>
        <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200">
            <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground truncate">Agentic RAG</h1>
            <p className="text-[10px] text-muted-foreground">GenAI System</p>
          </div>
        )}
      </div>

      <SidebarContent className={cn("py-3", collapsed ? "px-0" : "px-2")}>
        <SidebarGroup className={collapsed ? "p-0" : "p-2"}>
          <SidebarGroupContent>
            <SidebarMenu className={collapsed ? "items-center" : ""}>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title} className={collapsed ? "flex justify-center w-full" : ""}>
                  <SidebarMenuButton asChild className="h-10 rounded-lg transition-all duration-200">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium neon-border"
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("pb-4", collapsed ? "px-0" : "px-3")}>
        <button
          onClick={() => setDark(!dark)}
          className={cn(
            "flex items-center rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent/50 transition-all duration-200",
            collapsed ? "size-8 mx-auto justify-center" : "gap-3 w-full h-10 px-3"
          )}
          title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {dark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
          {!collapsed && <span>{dark ? "Light Mode" : "Dark Mode"}</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
