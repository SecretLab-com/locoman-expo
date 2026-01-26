import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Shopper pages
import Catalog from "./pages/shopper/Catalog";
import BundleDetail from "./pages/shopper/BundleDetail";
import Cart from "./pages/shopper/Cart";
import ShopperProducts from "./pages/shopper/Products";

// Trainer pages
import TrainerDashboard from "./pages/trainer/Dashboard";
import TrainerBundles from "./pages/trainer/Bundles";
import BundleEditor from "./pages/trainer/BundleEditor";
import TrainerClients from "./pages/trainer/Clients";
import ClientDetail from "./pages/trainer/ClientDetail";
import TrainerCalendar from "./pages/trainer/Calendar";
import TrainerMessages from "./pages/trainer/Messages";
import TrainerOrders from "./pages/trainer/Orders";
import TrainerSettings from "./pages/trainer/Settings";
import ImageAnalytics from "./pages/trainer/ImageAnalytics";
import TrainerEarnings from "./pages/trainer/Earnings";
import AdPartnerships from "./pages/trainer/AdPartnerships";
import TrainerPoints from "./pages/trainer/Points";
import TrainerDeliveries from "./pages/trainer/Deliveries";

// Client pages
import ClientHome from "./pages/client/Home";
import ClientSubscriptions from "./pages/client/Subscriptions";
import ClientOrders from "./pages/client/Orders";
import ClientSpending from "./pages/client/Spending";
import ClientDeliveries from "./pages/client/Deliveries";

// Manager pages
import ManagerDashboard from "./pages/manager/Dashboard";
import ManagerTemplates from "./pages/manager/Templates";
import ManagerTrainers from "./pages/manager/Trainers";
import TrainerDetail from "./pages/manager/TrainerDetail";
import ManagerProducts from "./pages/manager/Products";
import TemplateEditor from "./pages/manager/TemplateEditor";
import ManagerSettings from "./pages/manager/Settings";
import BundleApprovals from "./pages/manager/BundleApprovals";
import Analytics from "./pages/manager/Analytics";
import BundlePerformance from "./pages/manager/BundlePerformance";
import ManagerBundles from "./pages/manager/Bundles";
import ManagerBundleDetail from "./pages/manager/BundleDetail";
import AdApprovals from "./pages/manager/AdApprovals";
import ManagerInvitations from "./pages/manager/Invitations";
import ManagerDeliveries from "./pages/manager/Deliveries";
import ManagerUsers from "./pages/manager/Users";
import SPFManagement from "./pages/manager/SPFManagement";
import TagManagement from "./pages/manager/TagManagement";
import Profile from "./pages/Profile";
import TrainerLanding from "./pages/TrainerLanding";
import InviteAccept from "./pages/InviteAccept";
import Invite from "./pages/Invite";
import TrainerDirectory from "./pages/TrainerDirectory";
import PublicProfile from "./pages/PublicProfile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import BusinessSignup from "./pages/BusinessSignup";

// Dev pages (coordinator only)
import Impersonate from "./pages/dev/Impersonate";
import ImpersonationExitTransition from "./pages/dev/ImpersonationExitTransition";
import { ImpersonationBanner } from "./components/ImpersonationBanner";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Public trainer landing page */}
      <Route path="/t/:username" component={TrainerLanding} />
      
      {/* Public user profile */}
      <Route path="/u/:userId" component={PublicProfile} />
      
      {/* Invitation acceptance */}
      <Route path="/invite/:token" component={InviteAccept} />
      
      {/* Trainer directory */}
      <Route path="/trainers" component={TrainerDirectory} />
      
      {/* Business partner signup */}
      <Route path="/partner/:code" component={BusinessSignup} />
      
      {/* Shopper routes */}
      <Route path="/catalog" component={Catalog} />
      <Route path="/bundle/:id" component={BundleDetail} />
      <Route path="/cart" component={Cart} />
      <Route path="/products" component={ShopperProducts} />
      <Route path="/profile" component={Profile} />
      
      {/* Trainer routes */}
      <Route path="/trainer" component={TrainerDashboard} />
      <Route path="/trainer/bundles" component={TrainerBundles} />
      <Route path="/trainer/bundles/new" component={BundleEditor} />
      <Route path="/trainer/bundles/:id" component={BundleEditor} />
      <Route path="/trainer/clients" component={TrainerClients} />
      <Route path="/trainer/clients/:id" component={ClientDetail} />
      <Route path="/trainer/calendar" component={TrainerCalendar} />
      <Route path="/trainer/messages" component={TrainerMessages} />
      <Route path="/trainer/orders" component={TrainerOrders} />
      <Route path="/trainer/settings" component={TrainerSettings} />
      <Route path="/trainer/image-analytics" component={ImageAnalytics} />
      <Route path="/trainer/earnings" component={TrainerEarnings} />
      <Route path="/trainer/ads" component={AdPartnerships} />
      <Route path="/trainer/status" component={TrainerPoints} />
      <Route path="/trainer/deliveries" component={TrainerDeliveries} />
      
      {/* Client routes */}
      <Route path="/client" component={ClientHome} />
      <Route path="/client/subscriptions" component={ClientSubscriptions} />
      <Route path="/client/orders" component={ClientOrders} />
      <Route path="/client/spending" component={ClientSpending} />
      <Route path="/client/deliveries" component={ClientDeliveries} />
      
      {/* Manager routes */}
      <Route path="/manager" component={ManagerDashboard} />
      <Route path="/manager/templates" component={ManagerTemplates} />
      <Route path="/manager/templates/new" component={TemplateEditor} />
      <Route path="/manager/templates/:id" component={TemplateEditor} />
      <Route path="/manager/trainers" component={ManagerTrainers} />
      <Route path="/manager/trainers/:id" component={TrainerDetail} />
      <Route path="/manager/products" component={ManagerProducts} />
      <Route path="/manager/settings" component={ManagerSettings} />
      <Route path="/manager/tags" component={TagManagement} />
      <Route path="/manager/approvals" component={BundleApprovals} />
      <Route path="/manager/analytics" component={Analytics} />
      <Route path="/manager/bundle-performance" component={BundlePerformance} />
      <Route path="/manager/bundles" component={ManagerBundles} />
      <Route path="/manager/bundles/:id" component={ManagerBundleDetail} />
      <Route path="/manager/ad-approvals" component={AdApprovals} />
      <Route path="/manager/invitations" component={ManagerInvitations} />
      <Route path="/manager/deliveries" component={ManagerDeliveries} />
      <Route path="/manager/spf" component={SPFManagement} />
      <Route path="/manager/users" component={ManagerUsers} />
      <Route path="/manager/users/:id" component={TrainerDetail} />
      
      {/* Invitation routes */}
      <Route path="/invite/:token" component={Invite} />
      
      {/* Dev routes (coordinator only) */}
      <Route path="/dev/impersonate" component={Impersonate} />
      <Route path="/dev/impersonation-exit" component={ImpersonationExitTransition} />
      
      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <TooltipProvider>
          <Toaster />
          <ImpersonationBanner />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
