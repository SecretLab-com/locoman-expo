import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Mail,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Users,
  BarChart3,
} from "lucide-react";

interface InvitationAnalyticsProps {
  className?: string;
}

export function InvitationAnalytics({ className }: InvitationAnalyticsProps) {
  const { data: stats, isLoading } = trpc.bundles.getInvitationStats.useQuery();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const total = stats.sent || 1; // Avoid division by zero
  const viewRate = stats.sent > 0 ? ((stats.viewed + stats.accepted) / stats.sent) * 100 : 0;
  const acceptRate = stats.sent > 0 ? (stats.accepted / stats.sent) * 100 : 0;
  const conversionRate = (stats.viewed + stats.accepted) > 0 
    ? (stats.accepted / (stats.viewed + stats.accepted)) * 100 
    : 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Invitation Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <Mail className="h-5 w-5 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-700">{stats.sent}</p>
            <p className="text-xs text-blue-600">Total Sent</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <Eye className="h-5 w-5 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-purple-700">{stats.viewed}</p>
            <p className="text-xs text-purple-600">Viewed</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-700">{stats.accepted}</p>
            <p className="text-xs text-green-600">Accepted</p>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Conversion Funnel</h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                Sent
              </span>
              <span className="font-medium">{stats.sent}</span>
            </div>
            <Progress value={100} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-purple-500" />
                Viewed
              </span>
              <span className="font-medium">
                {stats.viewed + stats.accepted} ({viewRate.toFixed(0)}%)
              </span>
            </div>
            <Progress value={viewRate} className="h-2 [&>div]:bg-purple-500" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Accepted
              </span>
              <span className="font-medium">
                {stats.accepted} ({acceptRate.toFixed(0)}%)
              </span>
            </div>
            <Progress value={acceptRate} className="h-2 [&>div]:bg-green-500" />
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Status Breakdown</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              <Clock className="h-3 w-3 mr-1" />
              {stats.pending} Pending
            </Badge>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <XCircle className="h-3 w-3 mr-1" />
              {stats.declined} Declined
            </Badge>
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
              <Clock className="h-3 w-3 mr-1" />
              {stats.expired} Expired
            </Badge>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">View → Accept Rate</span>
            </div>
            <span className="font-semibold text-green-600">
              {conversionRate.toFixed(0)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function InvitationAnalyticsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-24" />
      </CardContent>
    </Card>
  );
}
