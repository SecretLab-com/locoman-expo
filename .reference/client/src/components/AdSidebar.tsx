import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Sparkles } from "lucide-react";

interface AdSidebarProps {
  bundleId?: number;
  trainerId?: number;
  className?: string;
}

export default function AdSidebar({ bundleId, trainerId, className = "" }: AdSidebarProps) {
  const { data: ads, isLoading } = trpc.ads.getBundleSidebarAds.useQuery({
    bundleId,
    trainerId,
  });

  const recordImpressionMutation = trpc.ads.recordImpression.useMutation();
  const recordClickMutation = trpc.ads.recordClick.useMutation();

  // Record impressions when ads are loaded
  useEffect(() => {
    if (ads && ads.length > 0) {
      ads.forEach((ad: any) => {
        recordImpressionMutation.mutate({ placementId: ad.id });
      });
    }
  }, [ads]);

  const handleAdClick = (ad: any) => {
    recordClickMutation.mutate({ placementId: ad.id });
    if (ad.linkUrl) {
      window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (isLoading || !ads || ads.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="w-3 h-3" />
        <span>Sponsored</span>
      </div>
      
      {ads.map((ad: any) => (
        <Card 
          key={ad.id} 
          className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleAdClick(ad)}
        >
          {ad.imageUrl && (
            <div className="aspect-video relative overflow-hidden">
              <img 
                src={ad.imageUrl} 
                alt={ad.headline || ad.business?.name || "Advertisement"}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <CardContent className="p-3">
            {ad.business && (
              <p className="text-xs text-muted-foreground mb-1">
                {ad.business.name}
              </p>
            )}
            {ad.headline && (
              <h4 className="font-semibold text-sm line-clamp-2 mb-1">
                {ad.headline}
              </h4>
            )}
            {ad.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {ad.description}
              </p>
            )}
            {ad.ctaText && ad.linkUrl && (
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdClick(ad);
                }}
              >
                {ad.ctaText}
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
