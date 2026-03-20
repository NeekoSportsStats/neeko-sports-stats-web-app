import { Terminal, GitBranch, Sparkles, Database, ChartBar as BarChart2 } from "lucide-react";

export interface AdminSection {
  path: string;
  label: string;
  icon: React.ElementType;
  defaultRedirect?: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { path: "/admin/control-room", label: "Control Room", icon: Terminal },
  { path: "/admin/pipeline",     label: "Pipeline",     icon: GitBranch },
  { path: "/admin/ai",           label: "AI",           icon: Sparkles },
  { path: "/admin/data",         label: "Data",         icon: Database },
  { path: "/admin/analytics",    label: "Analytics",    icon: BarChart2 },
];

export const ADMIN_DEFAULT_PATH = "/admin/control-room";
