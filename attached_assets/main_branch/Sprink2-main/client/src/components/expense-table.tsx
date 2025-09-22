import { Eye } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Expense } from "@shared/schema";

interface ExpenseTableProps {
  expenses: Expense[];
  title: string;
  onViewExpense?: (expense: Expense) => void;
}

export default function ExpenseTable({ expenses, title, onViewExpense }: ExpenseTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "reimbursed":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      default:
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "travel":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "meals":
      case "meals & entertainment":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "office":
      case "office supplies":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (expenses.length === 0) {
    return (
      <Card data-testid="expense-table">
        <CardHeader>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground" data-testid="no-expenses-message">No expenses found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="expense-table">
      <CardHeader className="flex flex-row items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <Button variant="ghost" size="sm" data-testid="view-all-button">
          View All
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id} className="hover:bg-muted/30" data-testid={`expense-row-${expense.id}`}>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium text-foreground" data-testid={`expense-description-${expense.id}`}>
                      {expense.description}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`expense-date-${expense.id}`}>
                      {formatDate(expense.date)}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getCategoryColor(expense.category)} data-testid={`expense-category-${expense.id}`}>
                    {expense.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-foreground font-medium" data-testid={`expense-amount-${expense.id}`}>
                  ${parseFloat(expense.amount).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(expense.status)} data-testid={`expense-status-${expense.id}`}>
                    {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onViewExpense?.(expense)}
                    data-testid={`view-expense-button-${expense.id}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
