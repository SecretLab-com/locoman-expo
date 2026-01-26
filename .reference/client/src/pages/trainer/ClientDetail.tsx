import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dumbbell,
  ChevronLeft,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Package,
  DollarSign,
  Clock,
  Edit,
  TrendingUp,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useIsImpersonating } from "@/components/ImpersonationBanner";

// Mock client data
const mockClient = {
  id: 1,
  name: "John Doe",
  email: "john.doe@email.com",
  phone: "+1 555-0101",
  status: "active",
  goals: ["strength", "weight_loss"],
  notes: "Prefers morning sessions. Has a minor knee injury - avoid heavy squats.",
  subscriptions: [
    {
      id: 1,
      bundleName: "Strength Week 1",
      status: "active",
      price: 149.99,
      cadence: "weekly",
      startDate: "2024-01-01",
      renewalDate: "2024-01-22",
    },
  ],
  sessions: [
    { id: 1, date: "2024-01-15", type: "training", duration: 60, status: "completed" },
    { id: 2, date: "2024-01-14", type: "check_in", duration: 15, status: "completed" },
    { id: 3, date: "2024-01-12", type: "training", duration: 60, status: "completed" },
    { id: 4, date: "2024-01-18", type: "training", duration: 60, status: "scheduled" },
  ],
  orders: [
    { id: 1, date: "2024-01-01", total: 149.99, status: "delivered" },
    { id: 2, date: "2024-01-08", total: 149.99, status: "delivered" },
    { id: 3, date: "2024-01-15", total: 149.99, status: "processing" },
  ],
  totalSpent: 1499.88,
  sessionsCompleted: 12,
  joinedAt: "2023-11-01",
};

export default function ClientDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isImpersonating = useIsImpersonating();

  const client = mockClient;

  return (
    <div className="min-h-screen bg-background">
      {/* Spacer for impersonation banner */}
      {isImpersonating && <div className="h-12" />}
      
      {/* Navigation */}
      <nav className={`border-b border-border bg-card sticky z-50 ${isImpersonating ? 'top-12' : 'top-0'}`}>
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/trainer/clients")}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLocation(`/trainer/messages?client=${client.id}`)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Message
            </Button>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Client
            </Button>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Client Profile Card */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <Avatar className="h-24 w-24 mx-auto mb-4">
                    <AvatarFallback className="text-2xl">
                      {client.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold text-foreground">{client.name}</h2>
                  <Badge className="mt-2 bg-green-100 text-green-700">{client.status}</Badge>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{client.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{client.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Client since {new Date(client.joinedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <Separator className="my-6" />

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Goals</h3>
                  <div className="flex flex-wrap gap-2">
                    {client.goals.map((goal) => (
                      <Badge key={goal} variant="outline" className="capitalize">
                        {goal.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator className="my-6" />

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
                  <p className="text-sm text-foreground/80">{client.notes}</p>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <DollarSign className="h-6 w-6 mx-auto text-green-600 mb-2" />
                  <div className="text-2xl font-bold">${client.totalSpent.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">Total Spent</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                  <div className="text-2xl font-bold">{client.sessionsCompleted}</div>
                  <div className="text-xs text-muted-foreground">Sessions</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="subscriptions">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
                <TabsTrigger value="sessions">Sessions</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
              </TabsList>

              {/* Subscriptions Tab */}
              <TabsContent value="subscriptions" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Active Subscriptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {client.subscriptions.length > 0 ? (
                      <div className="space-y-4">
                        {client.subscriptions.map((sub) => (
                          <div key={sub.id} className="p-4 rounded-lg bg-muted">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-foreground">{sub.bundleName}</h4>
                                <p className="text-sm text-muted-foreground capitalize">{sub.cadence}</p>
                              </div>
                              <Badge className="bg-green-100 text-green-700">{sub.status}</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                              <div>
                                <div className="text-muted-foreground">Price</div>
                                <div className="font-medium">${sub.price}/{sub.cadence}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Started</div>
                                <div className="font-medium">
                                  {new Date(sub.startDate).toLocaleDateString()}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Next Renewal</div>
                                <div className="font-medium">
                                  {new Date(sub.renewalDate).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p>No active subscriptions</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent value="sessions" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Sessions</CardTitle>
                    <Button size="sm">
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule Session
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {client.sessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-muted"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                session.type === "training"
                                  ? "bg-blue-100"
                                  : "bg-purple-100"
                              }`}
                            >
                              {session.type === "training" ? (
                                <Dumbbell className="h-5 w-5 text-blue-600" />
                              ) : (
                                <MessageSquare className="h-5 w-5 text-purple-600" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-foreground capitalize">
                                {session.type.replace("_", " ")}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(session.date).toLocaleDateString()} • {session.duration} min
                              </div>
                            </div>
                          </div>
                          <Badge
                            className={
                              session.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            }
                          >
                            {session.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Orders Tab */}
              <TabsContent value="orders" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Order History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {client.orders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-muted"
                        >
                          <div>
                            <div className="font-medium text-foreground">
                              Order #{order.id}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(order.date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-semibold">${order.total.toFixed(2)}</span>
                            <Badge
                              className={
                                order.status === "delivered"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-blue-100 text-blue-700"
                              }
                            >
                              {order.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
