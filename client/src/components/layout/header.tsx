import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground" data-testid="page-subtitle">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <button className="relative p-2 text-muted-foreground hover:text-foreground" data-testid="notifications-button">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full" data-testid="notification-indicator"></span>
          </button>
          <Link href="/new-expense">
            <Button data-testid="new-expense-button">
              <Plus className="w-4 h-4 mr-2" />
              New Expense
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
