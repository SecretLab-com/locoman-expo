import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  Package,
  Dumbbell,
  Building2,
  ChevronRight,
  Download,
  Calendar,
  User,
  Loader2,
} from "lucide-react";
import { PullToRefresh } from "@/components/PullToRefresh";

type Period = "month" | "year" | "all";

export default function ClientSpending() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { data: summary, isLoading: summaryLoading } = trpc.clientSpending.summary.useQuery({
    period,
  });

  const { data: transactionsData, isLoading: transactionsLoading } = trpc.clientSpending.transactions.useQuery({
    page: 1,
    limit: 50,
  });

  const { data: transactionDetail, isLoading: detailLoading } = trpc.clientSpending.transactionDetail.useQuery(
    { orderId: selectedOrderId! },
    { enabled: !!selectedOrderId }
  );

  const generateReceiptMutation = trpc.clientSpending.generateReceipt.useMutation();

  const utils = trpc.useUtils();

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await Promise.all([
      utils.clientSpending.summary.invalidate(),
      utils.clientSpending.transactions.invalidate(),
    ]);
  };

  const handleDownloadReceipt = async () => {
    if (!selectedOrderId) return;
    
    setIsGeneratingPdf(true);
    try {
      const result = await generateReceiptMutation.mutateAsync({ orderId: selectedOrderId });
      
      // Create a blob from the HTML and trigger download
      const blob = new Blob([result.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      
      // Open in new window for printing/saving as PDF
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      // Also provide direct download option
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${result.receiptNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate receipt:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getPeriodLabel = (p: Period) => {
    switch (p) {
      case "month": return "This Month";
      case "year": return "This Year";
      case "all": return "All Time";
    }
  };

  if (!user) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Please log in to view your spending history.</p>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen pb-24">
    <div className="container py-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Spending</h1>
          <p className="text-muted-foreground mt-1">
            Track your purchases and download receipts for reimbursement
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(summary?.totalSpent || 0)}</div>
                {summary?.periodComparison && (
                  <p className={`text-xs flex items-center gap-1 ${summary.periodComparison.change >= 0 ? "text-amber-600" : "text-green-600"}`}>
                    {summary.periodComparison.change >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(summary.periodComparison.change).toFixed(1)}% vs previous {period === "month" ? "month" : "year"}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(summary?.productTotal || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {summary?.totalSpent ? ((summary.productTotal / summary.totalSpent) * 100).toFixed(0) : 0}% of total
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services</CardTitle>
            <Dumbbell className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(summary?.serviceTotal || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {summary?.totalSpent ? ((summary.serviceTotal / summary.totalSpent) * 100).toFixed(0) : 0}% of total
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facility Fees</CardTitle>
            <Building2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(summary?.facilityTotal || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {summary?.totalSpent ? ((summary.facilityTotal / summary.totalSpent) * 100).toFixed(0) : 0}% of total
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Spending Breakdown Visual */}
      {summary && summary.totalSpent > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Spending Breakdown</CardTitle>
            <CardDescription>{getPeriodLabel(period)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-muted-foreground">Products</div>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${(summary.productTotal / summary.totalSpent) * 100}%` }}
                  />
                </div>
                <div className="w-24 text-sm font-medium text-right">{formatCurrency(summary.productTotal)}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-muted-foreground">Services</div>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${(summary.serviceTotal / summary.totalSpent) * 100}%` }}
                  />
                </div>
                <div className="w-24 text-sm font-medium text-right">{formatCurrency(summary.serviceTotal)}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm text-muted-foreground">Facility</div>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${(summary.facilityTotal / summary.totalSpent) * 100}%` }}
                  />
                </div>
                <div className="w-24 text-sm font-medium text-right">{formatCurrency(summary.facilityTotal)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction List */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Click on a transaction to view details and download receipt
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transactionsData?.transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactionsData?.transactions.map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => setSelectedOrderId(tx.id)}
                  className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Receipt className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{tx.bundleName || "Purchase"}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>{formatDate(tx.date)}</span>
                        {tx.trainerName && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {tx.trainerName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(tx.grossAmount)}</div>
                      <Badge variant={tx.status === "delivered" ? "default" : "secondary"} className="text-xs">
                        {tx.status}
                      </Badge>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Order #{selectedOrderId} • {transactionDetail?.order.date && formatDate(transactionDetail.order.date)}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : transactionDetail ? (
            <div className="space-y-6">
              {/* Trainer Info */}
              {transactionDetail.trainer && (
                <button
                  onClick={() => {
                    setSelectedOrderId(null);
                    window.location.href = `/u/${transactionDetail.trainer!.id}`;
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-left group"
                >
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium group-hover:text-primary transition-colors">{transactionDetail.trainer.name}</div>
                    <div className="text-sm text-muted-foreground">{transactionDetail.trainer.email}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              )}

              {/* Products Section */}
              {transactionDetail.products.length > 0 && (
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-blue-500" />
                    Products
                  </h4>
                  <div className="space-y-2">
                    {transactionDetail.products.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                            {item.vatRate > 0 && ` (${item.vatRate}% VAT)`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(item.totalPrice)}</div>
                          {item.vatAmount > 0 && (
                            <div className="text-xs text-muted-foreground">
                              VAT: {formatCurrency(item.vatAmount)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Services Section */}
              {transactionDetail.services.length > 0 && (
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Dumbbell className="h-4 w-4 text-green-500" />
                    Services
                  </h4>
                  <div className="space-y-2">
                    {transactionDetail.services.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                            {item.vatRate > 0 && ` (${item.vatRate}% VAT)`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(item.totalPrice)}</div>
                          {item.vatAmount > 0 && (
                            <div className="text-xs text-muted-foreground">
                              VAT: {formatCurrency(item.vatAmount)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Facility Fees Section */}
              {transactionDetail.facilities.length > 0 && (
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-purple-500" />
                    Facility Fees
                  </h4>
                  <div className="space-y-2">
                    {transactionDetail.facilities.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                          </div>
                        </div>
                        <div className="font-medium">{formatCurrency(item.totalPrice)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Products Subtotal</span>
                  <span>{formatCurrency(transactionDetail.totals.products)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Services Subtotal</span>
                  <span>{formatCurrency(transactionDetail.totals.services)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Facility Fees</span>
                  <span>{formatCurrency(transactionDetail.totals.facilities)}</span>
                </div>
                {transactionDetail.totals.vat > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT</span>
                    <span>{formatCurrency(transactionDetail.totals.vat)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(transactionDetail.totals.grand)}</span>
                </div>
              </div>

              {/* Download Button */}
              <Button 
                className="w-full" 
                variant="outline"
                onClick={handleDownloadReceipt}
                disabled={isGeneratingPdf}
              >
                {isGeneratingPdf ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isGeneratingPdf ? "Generating..." : "Download PDF Receipt"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                This receipt can be used for insurance claims, employer reimbursement, or tax purposes.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
}
