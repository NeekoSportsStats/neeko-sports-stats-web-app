import { Home, Trophy, Crown, Users, Share2, ChevronDown, User, Shield, Mail, HelpCircle, FileText, X } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState, useEffect } from "react";

const mainItems = [
  { title: "Home", url: "/", icon: Home },
];

const coreItems = [
  { title: "Neeko+", url: "/neeko-plus", icon: Crown },
  { title: "Account", url: "/account", icon: User },
];

const infoItems = [
  { title: "About Us", url: "/about", icon: Users },
  { title: "Socials", url: "/socials", icon: Share2 },
  { title: "FAQ", url: "/faq", icon: HelpCircle },
  { title: "Policies", url: "/policies", icon: FileText },
  { title: "Contact Us", url: "/contact", icon: Mail },
];

const aflSubItems = [
  { title: "Player Stats", url: "/sports/afl/players" },
  { title: "Team Stats", url: "/sports/afl/teams" },
  { title: "AI Analysis", url: "/sports/afl/ai-analysis" },
  { title: "Match Center", url: "/sports/afl/match-centre" },
];


const nbaSubItems = [
  { title: "Player Stats", url: "/sports/nba/players" },
  { title: "Team Stats", url: "/sports/nba/teams" },
  { title: "AI Analysis", url: "/sports/nba/ai-analysis" },
  { title: "Match Center", url: "/sports/nba/match-centre" },
];

const eplSubItems = [
  { title: "Player Stats", url: "/sports/epl/players" },
  { title: "Team Stats", url: "/sports/epl/teams" },
  { title: "AI Analysis", url: "/sports/epl/ai-analysis" },
  { title: "Match Center", url: "/sports/epl/match-centre" },
];

const adminItems = [
  { title: "Admin", url: "/admin", icon: Shield },
];

export function AppSidebar() {
  const { open: sidebarOpen, isMobile, setOpenMobile, setOpen } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const [isAdmin, setIsAdmin] = useState(false);

  const [sportsOpen, setSportsOpen] = useState(
    currentPath.startsWith("/sports")
  );

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      setIsAdmin(data || false);
    } catch (error) {
      setIsAdmin(false);
    }
  };

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="z-50">
      <SidebarHeader className="flex flex-row items-center justify-between">
        <span className="text-lg font-semibold">Menu</span>
        <button
          onClick={() => {
            if (isMobile) {
              setOpenMobile(false);
            } else {
              setOpen(false);
            }
          }}
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="py-1.5">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                      onClick={handleLinkClick}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Sports Collapsible */}
              <Collapsible open={sportsOpen} onOpenChange={setSportsOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={`py-1.5 hover:bg-muted/50 ${
                        isActive("/sports")
                          ? "bg-muted text-primary font-medium"
                          : ""
                      }`}
                    >
                      <Trophy className="h-4 w-4" />
                      <span>Sports</span>
                      <ChevronDown
                        className={`ml-auto h-4 w-4 transition-transform ${
                          sportsOpen ? "rotate-180" : ""
                        }`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {/* AFL Section */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild className="py-0.5">
                          <NavLink
                            to="/sports/afl"
                            className="hover:bg-muted/50 pl-6 font-semibold text-xs"
                            activeClassName="bg-muted text-primary font-medium"
                            onClick={handleLinkClick}
                          >
                            <span>AFL</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      {aflSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild className="py-0.5">
                            <NavLink
                              to={subItem.url}
                              className="hover:bg-muted/50 pl-8 text-xs"
                              activeClassName="bg-muted text-primary font-medium"
                              onClick={handleLinkClick}
                            >
                              <span>{subItem.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}


                      {/* EPL Section */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild className="py-0.5">
                          <NavLink
                            to="/sports/epl"
                            className="hover:bg-muted/50 pl-6 font-semibold text-xs"
                            activeClassName="bg-muted text-primary font-medium"
                            onClick={handleLinkClick}
                          >
                            <span>EPL</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      {eplSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild className="py-0.5">
                            <NavLink
                              to={subItem.url}
                              className="hover:bg-muted/50 pl-8 text-xs"
                              activeClassName="bg-muted text-primary font-medium"
                              onClick={handleLinkClick}
                            >
                              <span>{subItem.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}

                      {/* NBA Section */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild className="py-0.5">
                          <NavLink
                            to="/sports/nba"
                            className="hover:bg-muted/50 pl-6 font-semibold text-xs"
                            activeClassName="bg-muted text-primary font-medium"
                            onClick={handleLinkClick}
                          >
                            <span>NBA</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      {nbaSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild className="py-0.5">
                            <NavLink
                              to={subItem.url}
                              className="hover:bg-muted/50 pl-8 text-xs"
                              activeClassName="bg-muted text-primary font-medium"
                              onClick={handleLinkClick}
                            >
                              <span>{subItem.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Core Items */}
              {coreItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="py-1.5">
                    <NavLink
                      to={item.url}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                      onClick={handleLinkClick}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider */}
        <Separator className="my-2" />

        {/* Info & Support Section */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Info Items */}
              {infoItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="py-1.5">
                    <NavLink
                      to={item.url}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                      onClick={handleLinkClick}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Admin Items - Only show if user is admin */}
              {isAdmin && adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="py-1.5">
                    <NavLink
                      to={item.url}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                      onClick={handleLinkClick}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
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
