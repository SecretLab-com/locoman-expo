# LocoMotivate Navigation Architecture

> **Note:** This document was created to analyze the current navigation structure and propose simplifications.

## Current Navigation Structure

The app currently has **5 separate tab navigators** that switch based on user role, plus standalone screens. This creates a confusing experience where the bottom navigation changes when navigating between screens.

```mermaid
flowchart TB
    subgraph Root["Root Stack Navigator"]
        Login["/login"]
        Register["/register"]
        
        subgraph Tabs["(tabs) - Public/Guest"]
            TabsHome["index - Bundles"]
            TabsProducts["products"]
            TabsTrainers["trainers"]
            TabsCart["cart"]
            TabsProfile["profile"]
        end
        
        subgraph Client["(client) - Logged-in Client"]
            ClientHome["index - Dashboard"]
            ClientPrograms["subscriptions - Programs"]
            ClientDeliveries["deliveries"]
            ClientSpending["spending"]
            ClientOrders["orders (hidden)"]
        end
        
        subgraph Trainer["(trainer) - Trainer Role"]
            TrainerHome["index - Dashboard"]
            TrainerCalendar["calendar"]
            TrainerClients["clients"]
            TrainerDeliveries["deliveries"]
            TrainerEarnings["earnings"]
            TrainerBundles["bundles (hidden)"]
            TrainerOrders["orders (hidden)"]
            TrainerSettings["settings (hidden)"]
            TrainerPoints["points (hidden)"]
            TrainerInvite["invite (hidden)"]
            TrainerPartnerships["partnerships (hidden)"]
            TrainerJoinRequests["join-requests (hidden)"]
        end
        
        subgraph Manager["(manager) - Manager Role"]
            ManagerHome["index - Dashboard"]
            ManagerApprovals["approvals"]
            ManagerUsers["users"]
            ManagerAnalytics["analytics"]
            ManagerTrainers["trainers (hidden)"]
            ManagerDeliveries["deliveries (hidden)"]
            ManagerTemplates["templates (hidden)"]
            ManagerProducts["products (hidden)"]
            ManagerInvitations["invitations (hidden)"]
        end
        
        subgraph Coordinator["(coordinator) - Coordinator Role"]
            CoordHome["index - Dashboard"]
            CoordLogs["logs (hidden)"]
        end
        
        subgraph Standalone["Standalone Screens"]
            BundleDetail["/bundle/[id]"]
            BundleEditor["/bundle-editor/[id]"]
            ClientDetail["/client-detail/[id]"]
            Checkout["/checkout"]
            CheckoutConfirm["/checkout/confirmation"]
            Messages["/messages"]
            MessageDetail["/messages/[id]"]
            TrainerDetail["/trainer/[id]"]
            InviteToken["/invite/[token]"]
            TemplateEditor["/template-editor/[id]"]
        end
    end
    
    %% Problem: Discover More switches tab groups
    ClientHome -->|"Discover More"| Tabs
    
    %% Normal navigation
    TabsProfile -->|"Login"| Login
    TabsProfile -->|"Role Switch"| Client
    TabsProfile -->|"Role Switch"| Trainer
    TabsProfile -->|"Role Switch"| Manager
    
    Client -->|"View Bundle"| BundleDetail
    Trainer -->|"Edit Bundle"| BundleEditor
    Manager -->|"Edit Template"| TemplateEditor
```

## Problems Identified

| Problem | Description | Impact |
|---------|-------------|--------|
| **Tab Switching** | "Discover More" navigates from `(client)` to `(tabs)`, changing the entire bottom nav | Confusing UX - users lose their place |
| **Too Many Tab Groups** | 5 separate tab navigators based on role | Complex codebase, inconsistent experience |
| **Hidden Tabs** | Many screens are "hidden tabs" instead of stack screens | Awkward navigation patterns |
| **No Profile FAB** | Profile is a tab, not accessible from other screens | Users must switch tabs to access settings |

## Proposed Simplified Architecture

```mermaid
flowchart TB
    subgraph Root["Root Stack Navigator"]
        Login["/login"]
        Register["/register"]
        
        subgraph MainTabs["Main Tabs (All Users)"]
            Home["Home/Dashboard"]
            Discover["Discover/Browse"]
            Activity["Activity/Orders"]
            More["More/Menu"]
        end
        
        subgraph Modals["Modal Screens"]
            Profile["Profile Sheet"]
            Settings["Settings"]
            Cart["Cart Sheet"]
        end
        
        subgraph Stack["Stack Screens"]
            BundleDetail["/bundle/[id]"]
            BundleEditor["/bundle-editor/[id]"]
            TrainerDetail["/trainer/[id]"]
            Messages["/messages"]
            Checkout["/checkout"]
        end
    end
    
    %% Profile FAB accessible from anywhere
    MainTabs -->|"Profile FAB"| Profile
    
    %% Stack navigation (no tab switching)
    Home -->|"View Bundle"| BundleDetail
    Discover -->|"View Trainer"| TrainerDetail
    Activity -->|"View Order"| BundleDetail
```

## Key Changes

1. **Single Tab Navigator** - One consistent bottom nav for all users
2. **Role-Based Content** - Same tabs, different content based on role
3. **Profile FAB** - Floating action button in top-right for profile/settings access
4. **Stack Navigation** - All detail screens use stack navigation (no tab switching)
5. **Cart as Sheet** - Cart accessible via FAB or header button, not a tab

## Implementation Priority

1. Add Profile FAB component
2. Remove "Discover More" tab switching
3. Consolidate tab navigators
4. Move hidden tabs to stack screens
