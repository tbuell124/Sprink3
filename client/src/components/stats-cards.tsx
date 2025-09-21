import { DollarSign, Clock, CheckCircle, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsData {
  totalExpenses: number;
  pendingApproval: number;
  approved: number;
  reimbursed: number;
}

interface StatsCardsProps {
  data: StatsData;
}

export default function StatsCards({ data }: StatsCardsProps) {
  const stats = [
    {
      title: "Total Expenses",
      value: `$${data.totalExpenses.toLocaleString()}`,
      change: "+12% from last month",
      changeType: "positive" as const,
      icon: DollarSign,
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-primary",
      testId: "stat-total-expenses"
    },
    {
      title: "Pending Approval",
      value: data.pendingApproval.toString(),
      change: "3 urgent",
      changeType: "warning" as const,
      icon: Clock,
      bgColor: "bg-amber-100 dark:bg-amber-900/20",
      iconColor: "text-amber-600",
      testId: "stat-pending-approval"
    },
    {
      title: "Approved",
      value: data.approved.toString(),
      change: "This month",
      changeType: "positive" as const,
      icon: CheckCircle,
      bgColor: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600",
      testId: "stat-approved"
    },
    {
      title: "Reimbursed",
      value: `$${data.reimbursed.toLocaleString()}`,
      change: "Last 30 days",
      changeType: "neutral" as const,
      icon: CreditCard,
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600",
      testId: "stat-reimbursed"
    },
  ];

  const getChangeColor = (type: string) => {
    switch (type) {
      case "positive":
        return "text-green-600";
      case "warning":
        return "text-amber-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => (
        <Card key={stat.title} data-testid={stat.testId}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold text-foreground" data-testid={`${stat.testId}-value`}>
                  {stat.value}
                </p>
                <p className={`text-xs mt-1 ${getChangeColor(stat.changeType)}`} data-testid={`${stat.testId}-change`}>
                  {stat.change}
                </p>
              </div>
              <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`${stat.iconColor} w-6 h-6`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
