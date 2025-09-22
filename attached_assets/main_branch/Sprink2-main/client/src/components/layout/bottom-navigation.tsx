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
      className="fixed bottom-0 left-0 right-0 glass-effect border-t border-border z-50 safe-area-pb backdrop-blur-md mobile-slide-up"
      data-testid="bottom-navigation"
    >
      <div className="grid grid-cols-3 h-20 px-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "mobile-nav-item touch-feedback-soft cursor-pointer relative m-1",
                  "btn-mobile-lg", // Enhanced mobile touch target
                  isActive
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-primary"
                )}
                data-testid={item.testId}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-primary/25 to-primary/15 border border-primary/40 mobile-fade-in" />
                )}
                <item.icon 
                  className={cn(
                    "w-6 h-6 mb-1 relative z-10 transition-all duration-200",
                    isActive && "drop-shadow-[0_0_12px_hsl(151_91%_35%)]"
                  )} 
                />
                <span className={cn(
                  "mobile-text-caption leading-none relative z-10 transition-all duration-200",
                  isActive && "font-semibold"
                )}>
                  {item.name}
                </span>
                {/* Enhanced visual feedback for active state */}
                {isActive && (
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-primary rounded-full mobile-fade-in" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}