import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Search,
  Send,
  Paperclip,
  MessageSquare,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useIsImpersonating } from "@/components/ImpersonationBanner";

type Conversation = {
  conversationId: string;
  otherUserId: number;
  otherUserName: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
};

export default function TrainerMessages() {
  const { user } = useAuth();
  const isImpersonating = useIsImpersonating();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all messages for this user (we'll group them into conversations)
  const { data: allMessages, isLoading: loadingConversations, refetch: refetchConversations } = trpc.messages.conversations.useQuery();

  // Fetch messages for selected conversation
  const { data: conversationMessages, isLoading: loadingMessages, refetch: refetchMessages } = trpc.messages.list.useQuery(
    { conversationId: selectedConversation?.conversationId || "" },
    { enabled: !!selectedConversation }
  );

  // Send message mutation
  const sendMessageMutation = trpc.messages.send.useMutation({
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
      refetchConversations();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  // Mark messages as read
  const markReadMutation = trpc.messages.markRead.useMutation({
    onSuccess: () => {
      refetchConversations();
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages]);

  // Mark messages as read when opening conversation
  useEffect(() => {
    if (selectedConversation && selectedConversation.unreadCount > 0) {
      markReadMutation.mutate({ conversationId: selectedConversation.conversationId });
    }
  }, [selectedConversation]);

  // Group messages into conversations
  const conversations = useMemo(() => {
    if (!allMessages || !user) return [];
    
    const convMap = new Map<string, Conversation>();
    
    for (const msg of allMessages) {
      const convId = msg.conversationId;
      const otherUserId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
      
      if (!convMap.has(convId)) {
        convMap.set(convId, {
          conversationId: convId,
          otherUserId,
          otherUserName: `User ${otherUserId}`, // Would need to join with users table
          lastMessage: msg.content,
          lastMessageTime: new Date(msg.createdAt),
          unreadCount: msg.receiverId === user.id && !msg.readAt ? 1 : 0,
        });
      } else {
        const conv = convMap.get(convId)!;
        // Count unread messages
        if (msg.receiverId === user.id && !msg.readAt) {
          conv.unreadCount++;
        }
      }
    }
    
    return Array.from(convMap.values()).sort(
      (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
    );
  }, [allMessages, user]);

  const filteredConversations = conversations.filter((conv) =>
    conv.otherUserName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    sendMessageMutation.mutate({
      receiverId: selectedConversation.otherUserId,
      content: newMessage.trim(),
    });
  };

  // Mobile: show either conversation list or chat
  if (selectedConversation) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Spacer for impersonation banner */}
        {isImpersonating && <div className="h-12" />}
        
        {/* Chat header */}
        <div className={`p-3 border-b border-border bg-card flex items-center gap-3 sticky z-10 ${isImpersonating ? 'top-12' : 'top-0'}`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedConversation(null)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              {selectedConversation.otherUserName.split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">
              {selectedConversation.otherUserName}
            </h3>
            <p className="text-xs text-green-600">Online</p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-3">
              {(conversationMessages || []).map((message) => {
                const isOwn = message.senderId === user?.id;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card text-foreground rounded-bl-sm shadow-sm border border-border"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(new Date(message.createdAt))}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Message input */}
        <div className="p-3 border-t border-border bg-card">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <Paperclip className="h-5 w-5" />
            </Button>
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage} 
              size="icon" 
              className="h-9 w-9 shrink-0"
              disabled={sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell title="Messages">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-sm text-muted-foreground">Chat with your clients</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Conversations list */}
        {loadingConversations ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conv) => (
              <div
                key={conv.conversationId}
                className="p-4 bg-card rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-all border border-border"
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {conv.otherUserName.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{conv.otherUserName}</span>
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(conv.lastMessageTime)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">{conv.lastMessage}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge className="bg-blue-600 text-white shrink-0">{conv.unreadCount}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loadingConversations && filteredConversations.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No conversations</h3>
            <p className="text-muted-foreground">Start chatting with your clients</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Helper functions
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
