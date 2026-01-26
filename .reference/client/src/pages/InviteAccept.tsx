import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { CheckCircle, XCircle, Loader2, LogIn, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "ready" | "accepting" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const acceptInvitation = trpc.invitations.accept.useMutation({
    onSuccess: (data) => {
      setStatus("success");
      toast.success("Welcome! You're now connected with your trainer.");
      // Redirect to client dashboard after a short delay
      setTimeout(() => {
        setLocation("/client");
      }, 2000);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message || "Failed to accept invitation");
    },
  });

  useEffect(() => {
    if (!authLoading) {
      setStatus("ready");
    }
  }, [authLoading]);

  const handleAccept = () => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid invitation link");
      return;
    }
    setStatus("accepting");
    acceptInvitation.mutate({ token });
  };

  const handleLogin = () => {
    // Store the current URL to redirect back after login
    sessionStorage.setItem("redirectAfterLogin", window.location.pathname);
    window.location.href = getLoginUrl();
  };

  if (status === "loading" || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-blue-600 animate-spin mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">You're In!</h2>
            <p className="text-muted-foreground mb-4">
              You've successfully joined your trainer's roster. Redirecting to your dashboard...
            </p>
            <Loader2 className="h-5 w-5 mx-auto text-blue-600 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Invitation Error</h2>
            <p className="text-muted-foreground mb-6">{errorMessage}</p>
            <Button onClick={() => setLocation("/")} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ready state - show accept UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription>
            A trainer has invited you to join their client roster on LocoMotivate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user ? (
            <>
              <p className="text-center text-muted-foreground">
                Please log in or create an account to accept this invitation
              </p>
              <Button onClick={handleLogin} className="w-full" size="lg">
                <LogIn className="h-4 w-4 mr-2" />
                Log In to Accept
              </Button>
            </>
          ) : (
            <>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Logged in as</p>
                <p className="font-medium text-foreground">{user.email || user.name}</p>
              </div>
              <Button 
                onClick={handleAccept} 
                className="w-full" 
                size="lg"
                disabled={status === "accepting"}
              >
                {status === "accepting" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept Invitation
                  </>
                )}
              </Button>
            </>
          )}
          
          <p className="text-xs text-center text-muted-foreground">
            By accepting, you agree to share your profile with this trainer
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
