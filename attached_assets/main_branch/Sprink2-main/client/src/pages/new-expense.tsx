import { useLocation } from "wouter";
import Header from "@/components/layout/header";
import ExpenseForm from "@/components/expense-form";

export default function NewExpense() {
  const [, setLocation] = useLocation();

  const handleSuccess = () => {
    // Redirect to expenses page after successful submission
    setLocation('/expenses');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="New Expense" subtitle="Submit a new expense report for approval" />
      
      <div className="flex-1 overflow-auto p-6">
        <ExpenseForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
