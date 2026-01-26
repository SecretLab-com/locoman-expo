import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { 
  Building2, 
  CheckCircle, 
  Loader2, 
  TrendingUp,
  Users,
  Target,
  Award,
  ArrowRight,
  Dumbbell
} from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "sports_nutrition", label: "Sports Nutrition", description: "Supplements, protein, energy drinks" },
  { value: "fitness_equipment", label: "Fitness Equipment", description: "Gym gear, home fitness, wearables" },
  { value: "physiotherapy", label: "Physiotherapy", description: "Physical therapy, sports medicine" },
  { value: "healthy_food", label: "Healthy Food", description: "Restaurants, meal prep, organic food" },
  { value: "sports_retail", label: "Sports Retail", description: "Apparel, footwear, accessories" },
  { value: "wellness_recovery", label: "Wellness & Recovery", description: "Spa, massage, cryotherapy" },
  { value: "gym_studio", label: "Gym/Studio", description: "Fitness centers, yoga studios" },
  { value: "health_insurance", label: "Health Insurance", description: "Health plans, wellness programs" },
  { value: "sports_events", label: "Sports Events", description: "Races, tournaments, competitions" },
  { value: "other", label: "Other", description: "Other fitness-related business" },
];

const PACKAGE_INFO = [
  { tier: "bronze", name: "Bronze", fee: "£99/month", features: ["Bundle sidebar ads", "Basic analytics", "500 bonus points for trainer"] },
  { tier: "silver", name: "Silver", fee: "£249/month", features: ["All Bronze features", "Trainer profile ads", "Email newsletter", "1,000 bonus points for trainer"] },
  { tier: "gold", name: "Gold", fee: "£499/month", features: ["All Silver features", "Vending machine screens", "Priority placement", "2,000 bonus points for trainer"] },
  { tier: "platinum", name: "Platinum", fee: "£999/month", features: ["All Gold features", "Receipt confirmations", "Exclusive category lock", "5,000 bonus points for trainer"] },
];

export default function BusinessSignup() {
  const { code } = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"validate" | "form" | "success">("validate");
  
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    category: "" as string,
    contactName: "",
    description: "",
    interestedPackage: "" as "bronze" | "silver" | "gold" | "platinum" | "",
  });

  // Validate referral code
  const { data: referralData, isLoading: validating } = trpc.businessSignup.validateReferral.useQuery(
    { code: code || "" },
    { enabled: !!code }
  );

  // Submit mutation
  const submitMutation = trpc.businessSignup.submit.useMutation({
    onSuccess: () => {
      setStep("success");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (referralData) {
      if (referralData.valid) {
        setStep("form");
      } else {
        toast.error("Invalid referral code");
        navigate("/");
      }
    }
  }, [referralData, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name || !form.email || !form.contactName || !form.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    submitMutation.mutate({
      referralCode: code || "",
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      website: form.website || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      category: form.category as any,
      contactName: form.contactName,
      description: form.description || undefined,
      interestedPackage: form.interestedPackage || undefined,
    });
  };

  if (validating || step === "validate") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Validating referral code...</p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for your interest in partnering with LocoMotivate. Our team will review your application and contact you within 2-3 business days.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Your referring trainer, <strong>{referralData?.trainer?.name}</strong>, has been notified and will earn a commission when your partnership is activated.
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Return to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white py-16 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Dumbbell className="w-8 h-8" />
            <span className="text-2xl font-bold">LocoMotivate</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Partner With Us
          </h1>
          <p className="text-xl text-violet-100 mb-6 max-w-2xl mx-auto">
            Reach thousands of fitness enthusiasts through our network of personal trainers and their clients
          </p>
          {referralData?.trainer && referralData.trainer.name && (
            <div className="inline-flex items-center gap-3 bg-white/10 rounded-full px-6 py-3">
              {referralData.trainer.photoUrl ? (
                <img 
                  src={referralData.trainer.photoUrl} 
                  alt={referralData.trainer.name || "Trainer"}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  {referralData.trainer.name?.charAt(0) || "T"}
                </div>
              )}
              <span>Referred by <strong>{referralData.trainer.name}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="container max-w-6xl mx-auto py-12 px-4">
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <Card className="text-center p-6">
            <Target className="w-10 h-10 text-violet-600 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Targeted Reach</h3>
            <p className="text-sm text-muted-foreground">
              Connect with health-conscious consumers actively investing in fitness
            </p>
          </Card>
          <Card className="text-center p-6">
            <Users className="w-10 h-10 text-violet-600 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Trusted Network</h3>
            <p className="text-sm text-muted-foreground">
              Leverage trainer relationships for authentic brand endorsements
            </p>
          </Card>
          <Card className="text-center p-6">
            <TrendingUp className="w-10 h-10 text-violet-600 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Measurable Results</h3>
            <p className="text-sm text-muted-foreground">
              Track impressions, clicks, and conversions with detailed analytics
            </p>
          </Card>
          <Card className="text-center p-6">
            <Award className="w-10 h-10 text-violet-600 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Premium Placement</h3>
            <p className="text-sm text-muted-foreground">
              Feature your brand across bundles, profiles, and vending machines
            </p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Tell us about your business to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your Business Name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Name *</Label>
                    <Input
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                      placeholder="Your Name"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="contact@business.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+44 123 456 7890"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Business Category *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div>
                            <span className="font-medium">{cat.label}</span>
                            <span className="text-muted-foreground ml-2 text-sm">- {cat.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="https://www.yourbusiness.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="London"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="123 High Street"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tell us about your business</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description of your products/services and target audience..."
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Interested Package (optional)</Label>
                  <RadioGroup
                    value={form.interestedPackage}
                    onValueChange={(v) => setForm({ ...form, interestedPackage: v as any })}
                    className="grid grid-cols-2 gap-3"
                  >
                    {PACKAGE_INFO.map((pkg) => (
                      <div key={pkg.tier} className="relative">
                        <RadioGroupItem
                          value={pkg.tier}
                          id={pkg.tier}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={pkg.tier}
                          className="flex flex-col p-3 border rounded-lg cursor-pointer hover:bg-muted/50 peer-data-[state=checked]:border-violet-600 peer-data-[state=checked]:bg-violet-50"
                        >
                          <span className="font-semibold">{pkg.name}</span>
                          <span className="text-sm text-muted-foreground">{pkg.fee}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-violet-600 hover:bg-violet-700"
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                  ) : (
                    <>Submit Application <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Packages */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Advertising Packages</h3>
            {PACKAGE_INFO.map((pkg) => (
              <Card key={pkg.tier} className={form.interestedPackage === pkg.tier ? "border-violet-600 bg-violet-50/50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">{pkg.name}</h4>
                      <p className="text-2xl font-bold text-violet-600">{pkg.fee}</p>
                    </div>
                    <Button 
                      variant={form.interestedPackage === pkg.tier ? "default" : "outline"}
                      size="sm"
                      onClick={() => setForm({ ...form, interestedPackage: pkg.tier as any })}
                      className={form.interestedPackage === pkg.tier ? "bg-violet-600" : ""}
                    >
                      {form.interestedPackage === pkg.tier ? "Selected" : "Select"}
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {pkg.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-white py-8 px-4 mt-12">
        <div className="container max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Dumbbell className="w-6 h-6" />
            <span className="text-xl font-bold">LocoMotivate</span>
          </div>
          <p className="text-gray-400 text-sm">
            Connecting fitness professionals with their clients through personalized training bundles
          </p>
        </div>
      </div>
    </div>
  );
}
