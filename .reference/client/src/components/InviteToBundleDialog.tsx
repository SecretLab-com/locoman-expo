import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Package, Loader2, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InviteBundleDialog } from "./InviteBundleDialog";

interface InviteToBundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  clientName: string;
  clientEmail: string;
}

export function InviteToBundleDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  clientEmail,
}: InviteToBundleDialogProps) {
  const [selectedBundle, setSelectedBundle] = useState<{
    id: number;
    title: string;
  } | null>(null);

  // Fetch trainer's published bundles
  const { data: bundlesData, isLoading } = trpc.bundles.list.useQuery(undefined, {
    enabled: open,
  });

  const publishedBundles = (bundlesData || []).filter(
    (b) => b.status === "published"
  );

  const handleSelectBundle = (bundle: { id: number; title: string }) => {
    setSelectedBundle(bundle);
  };

  const handleClose = () => {
    setSelectedBundle(null);
    onOpenChange(false);
  };

  const handleBackToList = () => {
    setSelectedBundle(null);
  };

  // If a bundle is selected, show the invite dialog
  if (selectedBundle) {
    return (
      <InviteBundleDialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleClose();
          }
        }}
        bundleId={selectedBundle.id}
        bundleTitle={selectedBundle.title}
        preselectedClientId={clientId}
        preselectedClientName={clientName}
        preselectedClientEmail={clientEmail}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Invite to Bundle
          </DialogTitle>
          <DialogDescription>
            Select a bundle to invite <span className="font-medium">{clientName}</span> to
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : publishedBundles.length > 0 ? (
          <ScrollArea className="h-64">
            <div className="space-y-2 pr-4">
              {publishedBundles.map((bundle) => (
                <button
                  key={bundle.id}
                  onClick={() => handleSelectBundle({ id: bundle.id, title: bundle.title })}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left group"
                >
                  {bundle.imageUrl ? (
                    <img
                      src={bundle.imageUrl}
                      alt={bundle.title}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                      <Package className="h-6 w-6 text-primary/60" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{bundle.title}</p>
                    <p className="text-xs text-muted-foreground">
                      ${bundle.price ? (parseFloat(bundle.price) / 100).toFixed(2) : '0.00'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No published bundles</p>
            <p className="text-xs mt-1">Create and publish a bundle first to invite clients</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
