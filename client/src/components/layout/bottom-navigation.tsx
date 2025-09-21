import { Link, useLocation } from "wouter";
import { Home, Calendar, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { 
    name: "Dashboard", 
    href: "/", 
    icon: Home,
    testId: "nav-dashboard"
  },
  { 
    name: "Schedules", 
    href: "/schedules", 
    icon: Calendar,
    testId: "nav-schedules"
  },
  { 
    name: "Settings", 
    href: "/settings", 
    icon: Settings,
    testId: "nav-settings"
  },
];

export default function BottomNavigation() {
  const [location] = useLocation();

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 glass-effect border-t border-border z-50 safe-area-pb backdrop-blur-md"
      data-testid="bottom-navigation"
    >
      <div className="grid grid-cols-3 h-16">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center justify-center h-full px-2 modern-button cursor-pointer relative",
                  "min-h-[44px] touch-manipulation", // Ensure minimum touch target
                  isActive
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-primary"
                )}
                data-testid={item.testId}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-primary/20 to-primary/10 border border-primary/30" />
                )}
                <item.icon 
                  className={cn(
                    "w-5 h-5 mb-1 relative z-10 transition-all duration-200",
                    isActive && "drop-shadow-[0_0_8px_hsl(151_91%_35%)]"
                  )} 
                />
                <span className="text-xs font-medium leading-none relative z-10">
                  {item.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}