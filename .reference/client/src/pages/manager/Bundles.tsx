import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Search,
  Package,
  User,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
} from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";

type BundleStatus = "all" | "draft" | "pending_review" | "published" | "rejected";

export default function ManagerBundles() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BundleStatus>("all");
  const [trainerFilter, setTrainerFilter] = useState<string>("all");

  // Fetch all bundles
  const { data: allBundles, isLoading } = trpc.admin.allBundles.useQuery();

  // Handle shopifyProductId query param - redirect to specific bundle
  useEffect(() => {
    if (!allBundles || !searchString) return;
    
    const params = new URLSearchParams(searchString);
    const shopifyProductId = params.get("shopifyProductId");
    
    if (shopifyProductId) {
      // Find bundle with matching Shopify product ID
      const bundle = allBundles.find(
        (b) => b.shopifyProductId?.toString() === shopifyProductId
      );
      if (bundle) {
        // Redirect to the bundle detail page
        setLocation(`/manager/bundles/${bundle.id}`);
      }
    }
  }, [allBundles, searchString, setLocation]);

  // Filter bundles client-side
  const bundles = allBundles?.filter((b) => {
    // Status filter
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    // Trainer filter
    if (trainerFilter !== "all" && b.trainerId !== parseInt(trainerFilter)) return false;
    // Search filter
    if (search && !b.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Fetch trainers for filter dropdown
  const { data: trainers } = trpc.trainers.directory.useQuery();

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "published":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Published
          </Badge>
        );
      case "pending_review":
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Package className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/manager">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">All Bundles</h1>
              <p className="text-sm text-muted-foreground">
                Manage bundles across all trainers
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6 pb-24">
        {/* Filters */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bundles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Row */}
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BundleStatus)}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={trainerFilter} onValueChange={setTrainerFilter}>
              <SelectTrigger className="flex-1">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Trainer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trainers</SelectItem>
                {trainers?.map((trainer) => (
                  <SelectItem key={trainer.id} value={trainer.id.toString()}>
                    {trainer.name || trainer.email || `Trainer #${trainer.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Summary - Clickable to filter */}
        <div className="grid grid-cols-4 gap-3">
          <Card 
            className={`bg-muted/50 cursor-pointer transition-all hover:shadow-md ${statusFilter === "all" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{allBundles?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card 
            className={`bg-green-50 cursor-pointer transition-all hover:shadow-md ${statusFilter === "published" ? "ring-2 ring-green-500" : ""}`}
            onClick={() => setStatusFilter(statusFilter === "published" ? "all" : "published")}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {allBundles?.filter((b: { status: string | null }) => b.status === "published").length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Published</p>
            </CardContent>
          </Card>
          <Card 
            className={`bg-amber-50 cursor-pointer transition-all hover:shadow-md ${statusFilter === "pending_review" ? "ring-2 ring-amber-500" : ""}`}
            onClick={() => setStatusFilter(statusFilter === "pending_review" ? "all" : "pending_review")}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">
                {allBundles?.filter((b: { status: string | null }) => b.status === "pending_review").length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card 
            className={`bg-muted/50 cursor-pointer transition-all hover:shadow-md ${statusFilter === "draft" ? "ring-2 ring-muted-foreground" : ""}`}
            onClick={() => setStatusFilter(statusFilter === "draft" ? "all" : "draft")}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">
                {allBundles?.filter((b: { status: string | null }) => b.status === "draft" || !b.status).length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Drafts</p>
            </CardContent>
          </Card>
        </div>

        {/* Bundle List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : bundles && bundles.length > 0 ? (
          <div className="space-y-3">
            {bundles.map((bundle) => (
              <Card
                key={bundle.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setLocation(`/manager/bundles/${bundle.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {bundle.imageUrl ? (
                        <img
                          src={bundle.imageUrl}
                          alt={bundle.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold truncate">{bundle.title}</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/manager/trainers/${bundle.trainerId}`);
                            }}
                            className="flex items-center gap-2 text-sm text-muted-foreground mt-1 hover:text-primary transition-colors"
                          >
                            <User className="h-3 w-3" />
                            <span className="truncate">
                              {trainers?.find(t => t.id === bundle.trainerId)?.name || `Trainer #${bundle.trainerId}`}
                            </span>
                          </button>
                        </div>
                        {getStatusBadge(bundle.status)}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Bundle
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(bundle.updatedAt)}
                        </span>
                        {bundle.price && (
                          <span className="font-medium text-green-600">
                            ${Number(bundle.price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No bundles found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter !== "all" || trainerFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Trainers haven't created any bundles yet"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
