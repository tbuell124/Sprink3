import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import AnalyticsChart from "@/components/analytics-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30");

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/analytics', timeRange],
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Analytics" subtitle="Expense insights and reporting" />
        <div className="flex-1 overflow-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="bg-card border border-border rounded-lg h-12" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-lg h-80" />
              <div className="bg-card border border-border rounded-lg h-80" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const categoryData = analytics?.byCategory || [];
  const statusData = analytics?.byStatus || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Analytics" subtitle="Expense insights and reporting" />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Expense Analytics</CardTitle>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-48" data-testid="time-range-select">
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 3 months</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="total-amount">
                    ${analytics?.totalAmount?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="total-count">
                    {analytics?.totalCount || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="avg-amount">
                    ${analytics?.totalCount ? (analytics.totalAmount / analytics.totalCount).toFixed(2) : '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">Average Amount</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="categories-count">
                    {categoryData.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Categories Used</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          {categoryData.length > 0 ? (
            <AnalyticsChart categoryData={categoryData} statusData={statusData} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No expense data available for the selected time range</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
