import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Expense } from "@shared/schema";

export default function Approvals() {
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: expensesForApproval = [], isLoading } = useQuery({
    queryKey: ['/api/approvals'],
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) => {
      return apiRequest('PUT', `/api/expenses/${id}`, { status, rejectionReason });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      toast({
        title: "Success",
        description: `Expense ${variables.status} successfully`,
      });
      setSelectedExpense(null);
      setRejectionReason("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update expense status",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (expense: Expense) => {
    updateExpenseMutation.mutate({ id: expense.id, status: 'approved' });
  };

  const handleReject = (expense: Expense) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }
    updateExpenseMutation.mutate({ 
      id: expense.id, 
      status: 'rejected', 
      rejectionReason: rejectionReason.trim() 
    });
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Approvals" subtitle="Review and approve expense reports" />
        <div className="flex-1 overflow-auto p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (expensesForApproval.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Approvals" subtitle="Review and approve expense reports" />
        <div className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">All caught up!</h3>
              <p className="text-muted-foreground">No expense reports pending your approval</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Approvals" subtitle="Review and approve expense reports" />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {expensesForApproval.map((expense: Expense) => (
            <Card key={expense.id} data-testid={`approval-card-${expense.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg" data-testid={`expense-description-${expense.id}`}>
                      {expense.description}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground" data-testid={`expense-submitter-${expense.id}`}>
                      Submitted on {formatDate(expense.submittedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground" data-testid={`expense-amount-${expense.id}`}>
                      ${parseFloat(expense.amount).toFixed(2)}
                    </p>
                    <Badge variant="secondary" data-testid={`expense-category-${expense.id}`}>
                      {expense.category}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm font-medium text-foreground">Date</p>
                    <p className="text-sm text-muted-foreground">{formatDate(expense.date)}</p>
                  </div>
                  {expense.clientProject && (
                    <div>
                      <p className="text-sm font-medium text-foreground">Client/Project</p>
                      <p className="text-sm text-muted-foreground">{expense.clientProject}</p>
                    </div>
                  )}
                </div>

                {expense.notes && (
                  <div className="mb-6">
                    <p className="text-sm font-medium text-foreground mb-2">Notes</p>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      {expense.notes}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {expense.receiptUrl && (
                      <Button variant="outline" size="sm" data-testid={`view-receipt-${expense.id}`}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Receipt
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => setSelectedExpense(expense)}
                          data-testid={`reject-button-${expense.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reject Expense</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Please provide a reason for rejecting this expense report.
                          </p>
                          <Textarea
                            placeholder="Enter rejection reason..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={3}
                            data-testid="rejection-reason-input"
                          />
                          <div className="flex items-center justify-end space-x-2">
                            <Button variant="outline" onClick={() => setRejectionReason("")}>
                              Cancel
                            </Button>
                            <Button 
                              variant="destructive"
                              onClick={() => selectedExpense && handleReject(selectedExpense)}
                              disabled={updateExpenseMutation.isPending}
                              data-testid="confirm-reject-button"
                            >
                              Reject Expense
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button 
                      onClick={() => handleApprove(expense)}
                      disabled={updateExpenseMutation.isPending}
                      data-testid={`approve-button-${expense.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
