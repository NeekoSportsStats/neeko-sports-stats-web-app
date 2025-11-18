import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Crown, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import neekoLogo from "@/assets/neeko-sports-logo.svg";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, isPremium, signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center px-4">
              <SidebarTrigger className="mr-4" />
              
              <div className="flex items-center gap-2 mr-auto">
                <img src={neekoLogo} alt="Neeko Sports" className="h-8 w-auto" />
                <span className="font-bold text-lg hidden sm:inline-block">Neeko Sports</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Neeko+ link visible to all users */}
                <Link to="/neeko-plus">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Crown className="h-4 w-4" />
                    <span className="hidden sm:inline">Neeko+</span>
                  </Button>
                </Link>

                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={signOut}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                )}

                {!user && (
                  <Link to="/auth">
                    <Button variant="default" size="sm">
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="container py-6 px-4">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default Layout;
