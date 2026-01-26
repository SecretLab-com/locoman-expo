import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Loader2 } from "lucide-react";

export default function ImpersonationExitTransition() {
  const [, navigate] = useLocation();
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    // Show checkmark after a brief moment
    const checkTimer = setTimeout(() => {
      setShowCheck(true);
    }, 300);

    // Navigate to landing page after showing the message
    const navTimer = setTimeout(() => {
      navigate("/");
    }, 1500);

    return () => {
      clearTimeout(checkTimer);
      clearTimeout(navTimer);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="relative w-20 h-20 mx-auto mb-6">
          {!showCheck ? (
            <Loader2 className="w-20 h-20 animate-spin text-white/80" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center animate-in zoom-in duration-300">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2">Impersonation Ended</h1>
        <p className="text-white/80">Returning to your account...</p>
      </div>
    </div>
  );
}
