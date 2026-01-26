import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, Send, Copy, Check, Loader2, Users, UserPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface InviteBundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundleId: number;
  bundleTitle: string;
  preselectedClientId?: number;
  preselectedClientName?: string;
  preselectedClientEmail?: string;
}

export function InviteBundleDialog({
  open,
  onOpenChange,
  bundleId,
  bundleTitle,
  preselectedClientId,
  preselectedClientName,
  preselectedClientEmail,
}: InviteBundleDialogProps) {
  const [email, setEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("existing");

  // Fetch trainer's clients
  const { data: clientsData } = trpc.clients.list.useQuery(undefined, {
    enabled: open,
  });

  const clients = clientsData || [];

  // Handle preselected client
  useEffect(() => {
    if (preselectedClientId && preselectedClientName && preselectedClientEmail) {
      setSelectedClientId(preselectedClientId);
      setEmail(preselectedClientEmail);
      setRecipientName(preselectedClientName);
      setActiveTab("existing");
    }
  }, [preselectedClientId, preselectedClientName, preselectedClientEmail]);

  const sendInvitation = trpc.bundles.sendInvitation.useMutation({
    onSuccess: (data) => {
      const fullUrl = `${window.location.origin}${data.inviteUrl}`;
      setInviteUrl(fullUrl);
      toast.success("Invitation sent successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const handleSelectClient = (client: { id: number; name: string; email: string | null }) => {
    if (!client.email) return;
    setSelectedClientId(client.id);
    setEmail(client.email);
    setRecipientName(client.name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    sendInvitation.mutate({
      bundleId,
      email: email.trim(),
      recipientName: recipientName.trim() || undefined,
      personalMessage: personalMessage.trim() || undefined,
    });
  };

  const handleCopyLink = async () => {
    if (inviteUrl) {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setEmail("");
    setRecipientName("");
    setPersonalMessage("");
    setInviteUrl(null);
    setCopied(false);
    setSelectedClientId(null);
    setActiveTab("existing");
    onOpenChange(false);
  };

  const handleSendAnother = () => {
    setEmail("");
    setRecipientName("");
    setPersonalMessage("");
    setInviteUrl(null);
    setCopied(false);
    setSelectedClientId(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Invite to Bundle
          </DialogTitle>
          <DialogDescription>
            Send a personalized invitation for "{bundleTitle}" to a client.
          </DialogDescription>
        </DialogHeader>

        {!inviteUrl ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  My Clients
                </TabsTrigger>
                <TabsTrigger value="new" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  New Email
                </TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="mt-4">
                {clients.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Select a Client</Label>
                    <ScrollArea className="h-40 border rounded-md">
                      <div className="p-2 space-y-1">
                        {clients.map((client: { id: number; name: string; email: string | null }) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => client.email && handleSelectClient(client)}
                            disabled={!client.email}
                            className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors ${
                              selectedClientId === client.id
                                ? "bg-primary/10 border border-primary"
                                : "hover:bg-muted"
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-sm font-medium">
                              {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{client.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                            </div>
                            {selectedClientId === client.id && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                    {selectedClientId && (
                      <p className="text-sm text-muted-foreground">
                        Invitation will be sent to <span className="font-medium">{email}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No clients yet</p>
                    <p className="text-xs">Switch to "New Email" to invite someone new</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="new" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="client@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setSelectedClientId(null);
                    }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Recipient Name (optional)</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="message">Personal Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Hi! I think this bundle would be perfect for your fitness goals..."
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={sendInvitation.isPending || (!email.trim() && !selectedClientId)}
              >
                {sendInvitation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <Check className="h-5 w-5" />
                <span className="font-medium">Invitation Created!</span>
              </div>
              <p className="text-sm text-green-600">
                {recipientName || email} will receive an email with a link to view and accept this bundle.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Invitation Link</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You can also share this link directly. It expires in 7 days.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleSendAnother}>
                Send Another
              </Button>
              <Button type="button" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
