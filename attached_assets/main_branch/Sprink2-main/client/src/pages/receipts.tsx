import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Eye, FileText } from "lucide-react";

export default function Receipts() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['/api/expenses'],
  });

  const receipts = expenses.filter((expense: any) => expense.receiptUrl);
  const filteredReceipts = receipts.filter((receipt: any) => 
    receipt.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <Header title="Receipts" subtitle="Manage and view your receipt attachments" />
        <div className="flex-1 overflow-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="bg-card border border-border rounded-lg h-12" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-lg h-64" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Receipts" subtitle="Manage and view your receipt attachments" />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search receipts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="receipt-search"
                />
              </div>
            </CardContent>
          </Card>

          {/* Receipt Grid */}
          {filteredReceipts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReceipts.map((receipt: any) => (
                <Card key={receipt.id} data-testid={`receipt-card-${receipt.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base truncate" data-testid={`receipt-description-${receipt.id}`}>
                          {receipt.description}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground" data-testid={`receipt-date-${receipt.id}`}>
                          {formatDate(receipt.date)}
                        </p>
                      </div>
                      <Badge variant="secondary" data-testid={`receipt-category-${receipt.id}`}>
                        {receipt.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Receipt preview */}
                      <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                        <FileText className="w-12 h-12 text-muted-foreground" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Amount:</span>
                          <span className="font-medium" data-testid={`receipt-amount-${receipt.id}`}>
                            ${parseFloat(receipt.amount).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Status:</span>
                          <Badge 
                            variant={receipt.status === 'approved' ? 'default' : 'secondary'}
                            data-testid={`receipt-status-${receipt.id}`}
                          >
                            {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
                          </Badge>
                        </div>
                        {receipt.receiptFilename && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">File:</span>
                            <span className="text-xs text-muted-foreground truncate max-w-32">
                              {receipt.receiptFilename}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          data-testid={`view-receipt-${receipt.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          data-testid={`download-receipt-${receipt.id}`}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {searchTerm ? 'No receipts found' : 'No receipts uploaded'}
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? 'Try adjusting your search terms'
                    : 'Upload receipts when creating expense reports'
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
