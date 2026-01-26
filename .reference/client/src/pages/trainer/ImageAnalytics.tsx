import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  TrendingUp, 
  Image as ImageIcon, 
  Sparkles, 
  Camera, 
  Eye, 
  ShoppingCart,
  DollarSign,
  Lightbulb,
  Trophy,
  ArrowRight,
  Info
} from "lucide-react";
import { Link } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ImageAnalytics() {
  const [activeTab, setActiveTab] = useState("overview");
  
  const { data: insights, isLoading: insightsLoading } = trpc.bundles.imageInsights.useQuery();
  const { data: recommendations, isLoading: recommendationsLoading } = trpc.bundles.imageRecommendations.useQuery();
  const { data: comparison, isLoading: comparisonLoading } = trpc.bundles.imagePerformanceComparison.useQuery();
  
  const isLoading = insightsLoading || recommendationsLoading || comparisonLoading;

  if (isLoading) {
    return (
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const conversionRate = parseFloat(insights?.conversionRate || "0");
  const aiConversion = parseFloat(comparison?.ai.avgConversionRate || "0");
  const customConversion = parseFloat(comparison?.custom.avgConversionRate || "0");
  
  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Image Analytics
          </h1>
          <p className="text-muted-foreground">
            Track how your bundle cover images perform and get recommendations
          </p>
        </div>
        <Link href="/trainer/bundles">
          <Button variant="outline">
            <ImageIcon className="h-4 w-4 mr-2" />
            View Bundles
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bundles</p>
                <p className="text-2xl font-bold">{insights?.totalBundles || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">{insights?.totalViews?.toLocaleString() || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{insights?.totalSales || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{conversionRate.toFixed(2)}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="comparison">AI vs Custom</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Image Source Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Image Source Breakdown</CardTitle>
                <CardDescription>How your bundles are using different image types</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <span>AI Generated</span>
                    </div>
                    <span className="font-medium">{insights?.imageSourceBreakdown?.ai || 0}</span>
                  </div>
                  <Progress 
                    value={insights?.totalBundles ? ((insights.imageSourceBreakdown?.ai || 0) / insights.totalBundles) * 100 : 0} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-blue-500" />
                      <span>Custom Upload</span>
                    </div>
                    <span className="font-medium">{insights?.imageSourceBreakdown?.custom || 0}</span>
                  </div>
                  <Progress 
                    value={insights?.totalBundles ? ((insights.imageSourceBreakdown?.custom || 0) / insights.totalBundles) * 100 : 0} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Best Performer */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Your Best Performer
                </CardTitle>
                <CardDescription>The bundle with the highest sales</CardDescription>
              </CardHeader>
              <CardContent>
                {insights?.bestPerformer ? (
                  <div className="flex gap-4">
                    {insights.bestPerformer.imageUrl && (
                      <img 
                        src={insights.bestPerformer.imageUrl} 
                        alt={insights.bestPerformer.title}
                        className="w-24 h-24 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{insights.bestPerformer.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {insights.bestPerformer.imageSource === 'ai' ? (
                            <><Sparkles className="h-3 w-3 mr-1" />AI</>
                          ) : (
                            <><Camera className="h-3 w-3 mr-1" />Custom</>
                          )}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Views:</span>{" "}
                          <span className="font-medium">{insights.bestPerformer.viewCount || 0}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sales:</span>{" "}
                          <span className="font-medium">{insights.bestPerformer.salesCount || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No published bundles yet</p>
                    <Link href="/trainer/bundles/new">
                      <Button variant="link" className="mt-2">
                        Create your first bundle
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Your Bundles Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bundle Performance</CardTitle>
              <CardDescription>How each of your bundles is performing</CardDescription>
            </CardHeader>
            <CardContent>
              {insights?.bundles && insights.bundles.length > 0 ? (
                <div className="space-y-3">
                  {insights.bundles.slice(0, 5).map((bundle) => {
                    const bundleConversion = bundle.viewCount && bundle.viewCount > 0 
                      ? ((bundle.salesCount || 0) / bundle.viewCount) * 100 
                      : 0;
                    return (
                      <div key={bundle.id} className="flex items-center gap-4 p-3 rounded-lg border">
                        {bundle.imageUrl ? (
                          <img 
                            src={bundle.imageUrl} 
                            alt={bundle.title}
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{bundle.title}</h4>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {bundle.viewCount || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <ShoppingCart className="h-3 w-3" />
                              {bundle.salesCount || 0}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {bundleConversion.toFixed(1)}% conv.
                            </Badge>
                          </div>
                        </div>
                        <Badge variant={bundle.imageSource === 'ai' ? 'secondary' : 'outline'}>
                          {bundle.imageSource === 'ai' ? 'AI' : 'Custom'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No published bundles to analyze</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI vs Custom Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Generated vs Custom Upload Performance</CardTitle>
              <CardDescription>Platform-wide comparison of image types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* AI Stats */}
                <div className="p-4 rounded-lg border bg-purple-50/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold">AI Generated</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bundles</span>
                      <span className="font-medium">{comparison?.ai.count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Views</span>
                      <span className="font-medium">{comparison?.ai.totalViews?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Sales</span>
                      <span className="font-medium">{comparison?.ai.totalSales || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conversion Rate</span>
                      <span className="font-bold text-purple-600">{aiConversion.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>

                {/* Custom Stats */}
                <div className="p-4 rounded-lg border bg-blue-50/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Camera className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">Custom Upload</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bundles</span>
                      <span className="font-medium">{comparison?.custom.count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Views</span>
                      <span className="font-medium">{comparison?.custom.totalViews?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Sales</span>
                      <span className="font-medium">{comparison?.custom.totalSales || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conversion Rate</span>
                      <span className="font-bold text-blue-600">{customConversion.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Winner indicator */}
              {(aiConversion > 0 || customConversion > 0) && (
                <div className="mt-6 p-4 rounded-lg bg-muted/50 text-center">
                  {aiConversion > customConversion ? (
                    <p className="flex items-center justify-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <span>
                        <strong>AI Generated</strong> images are converting{" "}
                        <strong>{customConversion > 0 ? ((aiConversion - customConversion) / customConversion * 100).toFixed(0) : '∞'}%</strong> better
                      </span>
                    </p>
                  ) : customConversion > aiConversion ? (
                    <p className="flex items-center justify-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <span>
                        <strong>Custom Upload</strong> images are converting{" "}
                        <strong>{aiConversion > 0 ? ((customConversion - aiConversion) / aiConversion * 100).toFixed(0) : '∞'}%</strong> better
                      </span>
                    </p>
                  ) : (
                    <p>Both image types are performing equally</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Personalized Recommendations
              </CardTitle>
              <CardDescription>Tips to improve your bundle image performance</CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {recommendations.recommendations.map((rec, index) => (
                    <div key={index} className="flex gap-3 p-4 rounded-lg border bg-yellow-50/50">
                      <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="h-4 w-4 text-yellow-600" />
                      </div>
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Publish more bundles to get personalized recommendations</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* General Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Image Best Practices</CardTitle>
              <CardDescription>General tips for high-converting bundle images</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">📸 High Quality</h4>
                  <p className="text-sm text-muted-foreground">
                    Use 1024×1024px or higher resolution images for crisp display on all devices.
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">🎨 High Contrast</h4>
                  <p className="text-sm text-muted-foreground">
                    Images with clear contrast between products and background perform better.
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">👤 Show Products</h4>
                  <p className="text-sm text-muted-foreground">
                    Feature the actual products in your bundle to set clear expectations.
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">✨ Keep It Simple</h4>
                  <p className="text-sm text-muted-foreground">
                    Avoid cluttered images. Focus on 2-4 key products for visual clarity.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Performers Tab */}
        <TabsContent value="top-performers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Platform Top Performers
              </CardTitle>
              <CardDescription>
                Bundles with the highest conversion rates (minimum 10 views)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 ml-1 inline text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Learn from what's working across the platform</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations?.topPerformers && recommendations.topPerformers.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendations.topPerformers.map((bundle, index) => (
                    <div key={bundle.id} className="relative rounded-lg border overflow-hidden">
                      {index < 3 && (
                        <div className="absolute top-2 left-2 z-10">
                          <Badge className={
                            index === 0 ? "bg-yellow-500" : 
                            index === 1 ? "bg-gray-400" : 
                            "bg-amber-600"
                          }>
                            #{index + 1}
                          </Badge>
                        </div>
                      )}
                      {bundle.imageUrl ? (
                        <img 
                          src={bundle.imageUrl} 
                          alt={bundle.title}
                          className="w-full aspect-square object-cover"
                        />
                      ) : (
                        <div className="w-full aspect-square bg-muted flex items-center justify-center">
                          <ImageIcon className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-3">
                        <h4 className="font-medium text-sm truncate">{bundle.title}</h4>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-xs">
                            {bundle.imageSource === 'ai' ? 'AI' : 'Custom'}
                          </Badge>
                          <span className="text-sm font-bold text-green-600">
                            {bundle.conversionRate}% conv.
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{bundle.viewCount} views</span>
                          <span>{bundle.salesCount} sales</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Not enough data yet to show top performers</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
