"use client";

import { BarChart3, Hash, History, Layers, Settings } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const navItems = [
  { title: "Översikt", icon: BarChart3, isActive: true },
  { title: "Enstaka uppslag", icon: Hash },
  { title: "Batch-uppslag", icon: Layers },
  { title: "Historik", icon: History },
  { title: "Inställningar", icon: Settings },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Telecom Number Intelligence
        </p>
        <h1 className="mt-2 text-xl font-semibold">Ops Dashboard</h1>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={item.isActive}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>



      <SidebarRail />
    </Sidebar>
  );
}
