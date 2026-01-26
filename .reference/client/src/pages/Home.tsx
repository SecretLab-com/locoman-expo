import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { AppShell } from "@/components/AppShell";
import {
  Dumbbell,
  Package,
  Users,
  TrendingUp,
  Calendar,
  ShoppingCart,
  ChevronRight,
  Loader2,
  Zap,
  Heart,
  Target,
  Award,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to their role-specific dashboard
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      switch (user.role) {
        case "trainer":
          setLocation("/trainer");
          break;
        case "client":
          setLocation("/client");
          break;
        case "manager":
        case "coordinator":
          setLocation("/manager");
          break;
        default:
          // Shoppers stay on home/catalog
          break;
      }
    }
  }, [loading, isAuthenticated, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50">
        {/* Hero Section */}
        <section className="py-12 md:py-20">
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                  <Zap className="h-4 w-4" />
                  Trainer-Powered Wellness Platform
                </div>

                <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
                  Personalized Wellness,{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                    Powered by Experts
                  </span>
                </h1>

                <p className="text-lg text-muted-foreground leading-relaxed">
                  Connect with certified trainers who curate personalized supplement bundles tailored
                  to your fitness goals. From weight loss to strength building, get expert guidance
                  every step of the way.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" onClick={() => setLocation("/catalog")} className="text-base">
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Browse Bundles
                  </Button>
                  {!isAuthenticated && (
                    <>
                      <Button
                        size="lg"
                        variant="default"
                        onClick={() => setLocation("/login")}
                        className="text-base bg-blue-600 hover:bg-blue-700"
                      >
                        Sign In
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => setLocation("/login")}
                        className="text-base"
                      >
                        Become a Trainer
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">500+</div>
                    <div className="text-xs text-muted-foreground">Active Trainers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">10K+</div>
                    <div className="text-xs text-muted-foreground">Happy Clients</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">50K+</div>
                    <div className="text-xs text-muted-foreground">Bundles Sold</div>
                  </div>
                </div>
              </div>

              <div className="relative hidden lg:block">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-3xl blur-3xl" />
                <div className="relative grid grid-cols-2 gap-4">
                  <Card className="col-span-2 bg-white/80 backdrop-blur border-0 shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                          <Target className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">Strength Week 1</div>
                          <div className="text-sm text-muted-foreground">by Coach Sarah • $149.99</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/80 backdrop-blur border-0 shadow-xl">
                    <CardContent className="p-6">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-3">
                        <Heart className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="font-semibold text-foreground">Weight Loss</div>
                      <div className="text-sm text-muted-foreground">12 bundles</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/80 backdrop-blur border-0 shadow-xl">
                    <CardContent className="p-6">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
                        <Award className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="font-semibold text-foreground">Longevity</div>
                      <div className="text-sm text-muted-foreground">8 bundles</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Goal Types Section */}
        <section className="py-12 bg-card">
          <div className="container">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Bundles for Every Fitness Goal
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Our trainers create specialized bundles targeting specific fitness objectives.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  title: "Weight Loss",
                  description: "Fat burning & metabolic health",
                  icon: Heart,
                  color: "from-green-500 to-emerald-600",
                },
                {
                  title: "Strength",
                  description: "Muscle building & performance",
                  icon: Dumbbell,
                  color: "from-orange-500 to-red-500",
                },
                {
                  title: "Longevity",
                  description: "Long-term wellness",
                  icon: Award,
                  color: "from-purple-500 to-indigo-600",
                },
                {
                  title: "Power",
                  description: "Athletic performance",
                  icon: Zap,
                  color: "from-blue-500 to-cyan-500",
                },
              ].map((goal) => (
                <Card
                  key={goal.title}
                  className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-0 shadow-md"
                  onClick={() => setLocation(`/catalog?goal=${goal.title.toLowerCase()}`)}
                >
                  <CardContent className="p-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${goal.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
                    >
                      <goal.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="font-semibold text-foreground">{goal.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{goal.description}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Find a Trainer Section */}
        <section className="py-12 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <div className="container">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3 text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold">
                  Find Your Perfect Trainer
                </h2>
                <p className="text-blue-100 max-w-lg">
                  Browse our network of certified fitness trainers. Request to join their client roster
                  and get personalized guidance for your fitness journey.
                </p>
              </div>
              <Button
                size="lg"
                className="bg-white text-blue-700 hover:bg-blue-50 shrink-0"
                onClick={() => setLocation("/trainers")}
              >
                <Users className="mr-2 h-5 w-5" />
                Browse Trainers
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* For Trainers Section */}
        <section className="py-12 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-bold">
                  Grow Your Training Business
                </h2>
                <p className="text-muted-foreground/50">
                  Create personalized supplement bundles, manage clients, and earn recurring revenue
                  through our integrated platform.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {[
                    { icon: Package, text: "Bundle Builder" },
                    { icon: Users, text: "Client CRM" },
                    { icon: TrendingUp, text: "Analytics" },
                    { icon: Calendar, text: "Calendar" },
                  ].map((feature) => (
                    <div key={feature.text} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                        <feature.icon className="h-4 w-4 text-blue-400" />
                      </div>
                      <span className="text-sm text-slate-200">{feature.text}</span>
                    </div>
                  ))}
                </div>

                {!isAuthenticated && (
                  <Button
                    size="lg"
                    className="bg-white text-foreground hover:bg-muted mt-2"
                    onClick={() => (window.location.href = getLoginUrl())}
                  >
                    Start as a Trainer
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="relative hidden lg:block">
                <Card className="bg-white/10 backdrop-blur border-white/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-lg">Trainer Dashboard</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm">
                      Your business at a glance
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-white/5">
                        <div className="text-xl font-bold text-white">$8,450</div>
                        <div className="text-xs text-muted-foreground">Revenue (Month)</div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <div className="text-xl font-bold text-white">24</div>
                        <div className="text-xs text-muted-foreground">Active Clients</div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="font-semibold text-white text-sm mb-2">Today's Schedule</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground/50">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          9:00 AM - John Doe (Session)
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground/50">
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                          2:00 PM - Sarah K. (Check-in)
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile App Preview Banner */}
        <section className="py-8 bg-gradient-to-r from-violet-600 to-purple-600 text-white">
          <div className="container">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Try Our New Mobile App</h3>
                  <p className="text-violet-100 text-sm">Experience LocoMotivate on iOS, Android, and Web with our new Expo app</p>
                </div>
              </div>
              <Button
                size="lg"
                className="bg-white text-violet-700 hover:bg-violet-50 shrink-0"
                onClick={() => window.open('/expo', '_blank')}
              >
                <ExternalLink className="mr-2 h-5 w-5" />
                Open Mobile App
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 bg-muted/50 border-t">
          <div className="container">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                  <Dumbbell className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-foreground">LocoMotivate</span>
              </div>
              <div className="text-sm text-muted-foreground">
                © 2026 LocoMotivate. Trainer-powered wellness platform.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </AppShell>
  );
}
