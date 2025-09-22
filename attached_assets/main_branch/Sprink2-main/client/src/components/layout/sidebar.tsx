import { Link, useLocation } from "wouter";
import { Receipt, BarChart, Plus, List, CheckCircle, ChartBar, Folder, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart },
  { name: "New Expense", href: "/new-expense", icon: Plus },
  { name: "My Expenses", href: "/expenses", icon: List },
  { name: "Approvals", href: "/approvals", icon: CheckCircle },
  { name: "Analytics", href: "/analytics", icon: ChartBar },
  { name: "Receipts", href: "/receipts", icon: Folder },
  { name: "Team", href: "/team", icon: Users },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col" data-testid="sidebar">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Receipt className="text-primary-foreground w-4 h-4" />
          </div>
          <h1 className="text-xl font-bold text-foreground">ExpenseFlow</h1>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2" data-testid="navigation">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <a
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </a>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-primary-foreground">JD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate" data-testid="user-name">John Doe</p>
            <p className="text-xs text-muted-foreground truncate" data-testid="user-role">Account Manager</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
