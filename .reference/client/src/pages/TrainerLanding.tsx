import { trpc } from "@/lib/trpc";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { 
  User, 
  Instagram, 
  Twitter, 
  Linkedin, 
  Globe, 
  Target,
  Package,
  ArrowRight,
  Dumbbell,
  Heart,
  Zap,
  Trophy,
  Image as ImageIcon,
  Play,
  X,
} from "lucide-react";
import { useState } from "react";

const goalIcons: Record<string, React.ElementType> = {
  weight_loss: Heart,
  strength: Dumbbell,
  longevity: Zap,
  power: Trophy,
};

const goalColors: Record<string, string> = {
  weight_loss: "bg-pink-100 text-pink-700",
  strength: "bg-blue-100 text-blue-700",
  longevity: "bg-green-100 text-green-700",
  power: "bg-orange-100 text-orange-700",
};

export default function TrainerLanding() {
  const { username } = useParams<{ username: string }>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; provider: string; videoId: string } | null>(null);
  
  const { data: trainer, isLoading, error } = trpc.trainerProfile.byUsername.useQuery(
    { username: username || "" },
    { enabled: !!username }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex flex-col items-center mb-12">
            <Skeleton className="h-32 w-32 rounded-full mb-4" />
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !trainer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <User className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Trainer Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The trainer profile you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/">
              <Button>Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const specialties = (trainer.specialties as string[] | null) || [];
  const socialLinks = (trainer.socialLinks as Record<string, string> | null) || {};
  
  // Fetch media
  const { data: media } = trpc.trainerProfile.getPublicMedia.useQuery(
    { username: username || "" },
    { enabled: !!username }
  );
  
  const galleryImages = media?.filter((m) => m.type === "gallery_image") || [];
  const videos = media?.filter((m) => m.type === "video") || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="flex flex-col items-center text-center">
            {trainer.photoUrl ? (
              <img
                src={trainer.photoUrl}
                alt={trainer.name || "Trainer"}
                className="h-32 w-32 rounded-full border-4 border-white shadow-lg mb-6 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-32 w-32 rounded-full border-4 border-white shadow-lg mb-6 bg-white/20 flex items-center justify-center">
                <User className="h-16 w-16 text-white/80" />
              </div>
            )}
            <h1 className="text-4xl font-bold mb-2">{trainer.name || "Trainer"}</h1>
            <p className="text-blue-100 text-lg mb-4">@{trainer.username}</p>
            
            {trainer.bio && (
              <p className="text-white/90 max-w-2xl text-lg leading-relaxed mb-6">
                {trainer.bio}
              </p>
            )}

            {/* Specialties */}
            {specialties.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {specialties.map((specialty) => (
                  <Badge key={specialty} variant="secondary" className="bg-white/20 text-white border-0">
                    {specialty.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            )}

            {/* Social Links */}
            {Object.keys(socialLinks).length > 0 && (
              <div className="flex gap-4">
                {socialLinks.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-blue-200 transition-colors">
                    <Instagram className="h-6 w-6" />
                  </a>
                )}
                {socialLinks.twitter && (
                  <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-blue-200 transition-colors">
                    <Twitter className="h-6 w-6" />
                  </a>
                )}
                {socialLinks.linkedin && (
                  <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-blue-200 transition-colors">
                    <Linkedin className="h-6 w-6" />
                  </a>
                )}
                {socialLinks.website && (
                  <a href={socialLinks.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-200 transition-colors">
                    <Globe className="h-6 w-6" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Gallery Section */}
      {galleryImages.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-8">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-foreground">Gallery</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {galleryImages.map((img) => (
              <div
                key={img.id}
                className="aspect-square cursor-pointer overflow-hidden rounded-lg hover:opacity-90 transition-opacity"
                onClick={() => setSelectedImage(img.url)}
              >
                <img
                  src={img.url}
                  alt={img.title || "Gallery image"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Videos Section */}
      {videos.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 py-12 border-t border-border">
          <div className="flex items-center gap-3 mb-8">
            <Play className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-foreground">Videos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <div
                key={video.id}
                className="cursor-pointer group"
                onClick={() => setSelectedVideo({
                  url: video.url,
                  provider: video.videoProvider || "youtube",
                  videoId: video.videoId || "",
                })}
              >
                <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title || "Video thumbnail"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-200">
                      <Play className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 bg-black/60 rounded-full flex items-center justify-center group-hover:bg-red-600 transition-colors">
                      <Play className="h-7 w-7 text-white ml-1" />
                    </div>
                  </div>
                </div>
                {video.title && (
                  <p className="mt-2 font-medium text-foreground">{video.title}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bundles Section */}
      <div className="max-w-4xl mx-auto px-4 py-12 border-t border-border">
        <div className="flex items-center gap-3 mb-8">
          <Package className="h-6 w-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground">Training Bundles</h2>
        </div>

        {trainer.bundles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No bundles available yet. Check back soon!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {trainer.bundles.map((bundle) => {
              const GoalIcon = bundle.templateId ? goalIcons[bundle.templateId.toString()] || Target : Target;
              
              return (
                <Link key={bundle.id} href={`/bundle/${bundle.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                    {/* Cover Image */}
                    {bundle.imageUrl ? (
                      <div className="aspect-video bg-black relative overflow-hidden">
                        <img
                          src={bundle.imageUrl}
                          alt={bundle.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="text-xl font-bold text-white">{bundle.title}</h3>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Package className="h-16 w-16 text-muted-foreground/50" />
                      </div>
                    )}
                    
                    <CardContent className="p-4">
                      {!bundle.imageUrl && (
                        <h3 className="text-lg font-semibold text-foreground mb-2">{bundle.title}</h3>
                      )}
                      
                      {bundle.description && (
                        <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                          {bundle.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {bundle.price && (
                            <span className="text-lg font-bold text-foreground">
                              ${parseFloat(bundle.price).toFixed(2)}
                            </span>
                          )}
                          {bundle.cadence && bundle.cadence !== "one_time" && (
                            <span className="text-sm text-muted-foreground">
                              /{bundle.cadence === "weekly" ? "week" : "month"}
                            </span>
                          )}
                        </div>
                        
                        <Button variant="ghost" size="sm" className="group-hover:bg-blue-50 group-hover:text-blue-600">
                          View Details
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-muted-foreground text-sm">
          <p>Powered by <Link href="/" className="text-blue-600 hover:underline">LocoMotivate</Link></p>
        </div>
      </div>

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-0">
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Gallery image"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Video Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-0">
          <button
            onClick={() => setSelectedVideo(null)}
            className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          {selectedVideo && (
            <div className="aspect-video">
              {selectedVideo.provider === "youtube" && selectedVideo.videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : selectedVideo.provider === "vimeo" && selectedVideo.videoId ? (
                <iframe
                  src={`https://player.vimeo.com/video/${selectedVideo.videoId}?autoplay=1`}
                  className="w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <a href={selectedVideo.url} target="_blank" rel="noopener noreferrer" className="underline">
                    Open video in new tab
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
