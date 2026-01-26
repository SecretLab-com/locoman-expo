import { useState, useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UserAvatar } from "@/components/AvatarUpload";
import {
  Mail,
  Send,
  Loader2,
  Users,
  UserPlus,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  Search,
  Upload,
  FileText,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BulkInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundleId: number;
  bundleTitle: string;
}

type InviteResult = {
  email: string;
  name?: string;
  success: boolean;
  error?: string;
};

export function BulkInviteDialog({
  open,
  onOpenChange,
  bundleId,
  bundleTitle,
}: BulkInviteDialogProps) {
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set());
  const [manualEmails, setManualEmails] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("clients");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);

  // Fetch trainer's clients
  const { data: clientsData } = trpc.clients.list.useQuery(undefined, {
    enabled: open,
  });

  const clients = clientsData || [];

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client: { name: string; email: string | null }) =>
        client.name.toLowerCase().includes(query) ||
        (client.email && client.email.toLowerCase().includes(query))
    );
  }, [clients, searchQuery]);

  // Get clients with emails only
  const clientsWithEmail = filteredClients.filter(
    (client: { email: string | null }) => client.email
  );

  const sendInvitation = trpc.bundles.sendInvitation.useMutation();

  const handleToggleClient = (clientId: number) => {
    setSelectedClientIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allIds = clientsWithEmail.map((c: { id: number }) => c.id);
    setSelectedClientIds(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedClientIds(new Set());
  };

  // Parse manual emails from textarea
  const parseManualEmails = (): { email: string; name?: string }[] => {
    const lines = manualEmails
      .split(/[\n,;]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      // Try to parse "Name <email>" format
      const match = line.match(/^(.+?)\s*<(.+@.+)>$/);
      if (match) {
        return { name: match[1].trim(), email: match[2].trim() };
      }
      // Try to parse "email (Name)" format
      const match2 = line.match(/^(.+@.+)\s*\((.+)\)$/);
      if (match2) {
        return { email: match2[1].trim(), name: match2[2].trim() };
      }
      // Just email
      return { email: line };
    });
  };

  const handleSubmit = async () => {
    setSending(true);
    const inviteResults: InviteResult[] = [];

    // Get selected clients
    const selectedClients = clients.filter((c: { id: number }) =>
      selectedClientIds.has(c.id)
    );

    // Combine with manual emails
    const allInvites: { email: string; name?: string }[] = [
      ...selectedClients.map((c: { email: string | null; name: string }) => ({
        email: c.email!,
        name: c.name,
      })),
      ...parseManualEmails(),
    ];

    // Remove duplicates by email
    const uniqueInvites = allInvites.filter(
      (invite, index, self) =>
        index === self.findIndex((i) => i.email.toLowerCase() === invite.email.toLowerCase())
    );

    if (uniqueInvites.length === 0) {
      toast.error("Please select at least one client or enter email addresses");
      setSending(false);
      return;
    }

    // Send invitations sequentially to avoid rate limiting
    for (const invite of uniqueInvites) {
      try {
        await sendInvitation.mutateAsync({
          bundleId,
          email: invite.email,
          recipientName: invite.name,
          personalMessage: personalMessage.trim() || undefined,
        });
        inviteResults.push({
          email: invite.email,
          name: invite.name,
          success: true,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to send";
        inviteResults.push({
          email: invite.email,
          name: invite.name,
          success: false,
          error: errorMessage,
        });
      }
    }

    setResults(inviteResults);
    setSending(false);

    const successCount = inviteResults.filter((r) => r.success).length;
    const failCount = inviteResults.filter((r) => !r.success).length;

    if (failCount === 0) {
      toast.success(`Successfully sent ${successCount} invitation${successCount !== 1 ? "s" : ""}!`);
    } else if (successCount === 0) {
      toast.error(`Failed to send all ${failCount} invitation${failCount !== 1 ? "s" : ""}`);
    } else {
      toast.warning(`Sent ${successCount}, failed ${failCount} invitation${failCount !== 1 ? "s" : ""}`);
    }
  };

  const handleClose = () => {
    setSelectedClientIds(new Set());
    setManualEmails("");
    setPersonalMessage("");
    setSearchQuery("");
    setActiveTab("clients");
    setResults(null);
    onOpenChange(false);
  };

  const handleSendMore = () => {
    setSelectedClientIds(new Set());
    setManualEmails("");
    setResults(null);
  };

  const totalSelected =
    selectedClientIds.size + parseManualEmails().length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Bulk Invite to Bundle
          </DialogTitle>
          <DialogDescription>
            Send invitations for "{bundleTitle}" to multiple clients at once.
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="clients" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Select Clients
                  {selectedClientIds.size > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedClientIds.size}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Paste Emails
                </TabsTrigger>
              </TabsList>

              <TabsContent value="clients" className="mt-4 space-y-3">
                {clients.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search clients..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={
                          selectedClientIds.size === clientsWithEmail.length
                            ? handleDeselectAll
                            : handleSelectAll
                        }
                      >
                        {selectedClientIds.size === clientsWithEmail.length
                          ? "Deselect All"
                          : "Select All"}
                      </Button>
                    </div>

                    <ScrollArea className="h-48 border rounded-md">
                      <div className="p-2 space-y-1">
                        {filteredClients.map(
                          (client: {
                            id: number;
                            name: string;
                            email: string | null;
                            photoUrl?: string | null;
                          }) => (
                            <label
                              key={client.id}
                              className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                                !client.email
                                  ? "opacity-50 cursor-not-allowed"
                                  : selectedClientIds.has(client.id)
                                  ? "bg-primary/10"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <Checkbox
                                checked={selectedClientIds.has(client.id)}
                                onCheckedChange={() =>
                                  client.email && handleToggleClient(client.id)
                                }
                                disabled={!client.email}
                              />
                              <UserAvatar
                                photoUrl={client.photoUrl}
                                name={client.name}
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {client.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {client.email || "No email"}
                                </p>
                              </div>
                            </label>
                          )
                        )}
                        {filteredClients.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No clients found
                          </p>
                        )}
                      </div>
                    </ScrollArea>

                    <p className="text-xs text-muted-foreground">
                      {selectedClientIds.size} client
                      {selectedClientIds.size !== 1 ? "s" : ""} selected
                    </p>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">No clients yet</p>
                    <p className="text-xs mt-1">
                      Switch to "Paste Emails" to invite new people
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manual" className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="emails">Email Addresses</Label>
                  <Textarea
                    id="emails"
                    placeholder={`Enter email addresses (one per line or comma-separated):\n\njohn@example.com\nJane Doe <jane@example.com>\nsarah@example.com (Sarah Smith)`}
                    value={manualEmails}
                    onChange={(e) => setManualEmails(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports formats: email@example.com, Name &lt;email@example.com&gt;,
                    or email@example.com (Name)
                  </p>
                </div>

                {parseManualEmails().length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {parseManualEmails().map((invite, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {invite.name ? `${invite.name} (${invite.email})` : invite.email}
                      </Badge>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="message">Personal Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Hi! I think this bundle would be perfect for your fitness goals..."
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This message will be included in all invitations
              </p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="flex-1 text-sm text-muted-foreground">
                {totalSelected > 0 && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {totalSelected} invitation{totalSelected !== 1 ? "s" : ""} will be
                    sent
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={sending || totalSelected === 0}
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send {totalSelected} Invitation{totalSelected !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-700">
                  {results.filter((r) => r.success).length}
                </p>
                <p className="text-xs text-green-600">Sent Successfully</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-700">
                  {results.filter((r) => !r.success).length}
                </p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
            </div>

            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                      result.success ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    {result.success ? (
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate">
                        {result.name ? `${result.name} (${result.email})` : result.email}
                      </p>
                      {result.error && (
                        <p className="text-xs text-red-600 truncate">{result.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleSendMore}>
                Send More
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
