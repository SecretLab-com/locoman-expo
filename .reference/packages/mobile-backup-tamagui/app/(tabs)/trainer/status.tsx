import React, { useState } from 'react';
import { ScrollView, RefreshControl, Pressable } from 'react-native';
import { YStack, XStack, Text, Switch as TSwitch } from 'tamagui';
import { 
  User, 
  Star, 
  Package, 
  Users,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
  Camera,
  MapPin,
  Mail,
  Phone,
  Globe,
  Instagram,
  Twitter,
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { Progress } from '@/components/ui/Progress';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

export default function TrainerStatus() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = trpc.trainer.getProfile.useQuery();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.trainer.getStats.useQuery();
  const { data: availability, refetch: refetchAvailability } = trpc.trainer.getAvailability.useQuery();
  
  const updateAvailabilityMutation = trpc.trainer.updateAvailability.useMutation({
    onSuccess: () => {
      toast({ title: 'Success', description: 'Availability updated' });
      refetchAvailability();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
  
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchStats(), refetchAvailability()]);
    setRefreshing(false);
  };
  
  const isLoading = profileLoading || statsLoading;
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  const toggleAvailability = () => {
    updateAvailabilityMutation.mutate({
      available: !availability?.available,
    });
  };
  
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f5f5f5' }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <YStack padding="$4" gap="$4">
        {/* Profile Header */}
        {profileLoading ? (
          <Skeleton height={200} borderRadius="$4" />
        ) : (
          <Card>
            <CardContent>
              <YStack alignItems="center" gap="$3">
                <Pressable onPress={() => router.push('/trainer/edit-profile')}>
                  <YStack position="relative">
                    <Avatar
                      src={profile?.photoUrl || user?.photoUrl}
                      fallback={profile?.name?.charAt(0) || user?.name?.charAt(0) || 'T'}
                      size="xl"
                    />
                    <YStack
                      position="absolute"
                      bottom={0}
                      right={0}
                      backgroundColor="$blue10"
                      padding="$2"
                      borderRadius="$4"
                    >
                      <Camera size={16} color="white" />
                    </YStack>
                  </YStack>
                </Pressable>
                
                <YStack alignItems="center" gap="$1">
                  <XStack alignItems="center" gap="$2">
                    <Text fontSize="$6" fontWeight="700">{profile?.name || user?.name}</Text>
                    {getStatusBadge(profile?.status || 'active')}
                  </XStack>
                  
                  {profile?.specialization && (
                    <Text fontSize="$3" color="$gray10">{profile.specialization}</Text>
                  )}
                  
                  {profile?.rating !== undefined && (
                    <XStack alignItems="center" gap="$1">
                      <Star size={16} color="$yellow10" fill="$yellow10" />
                      <Text fontSize="$4" fontWeight="600">{profile.rating.toFixed(1)}</Text>
                      <Text fontSize="$3" color="$gray10">
                        ({profile.reviewCount || 0} reviews)
                      </Text>
                    </XStack>
                  )}
                </YStack>
                
                <Button
                  variant="outline"
                  icon={<Edit size={16} />}
                  onPress={() => router.push('/trainer/edit-profile')}
                >
                  Edit Profile
                </Button>
              </YStack>
            </CardContent>
          </Card>
        )}
        
        {/* Availability Toggle */}
        <Card>
          <CardContent>
            <XStack justifyContent="space-between" alignItems="center">
              <YStack>
                <Text fontSize="$4" fontWeight="600">Available for New Clients</Text>
                <Text fontSize="$2" color="$gray10">
                  {availability?.available 
                    ? 'You are visible to potential clients' 
                    : 'You are hidden from search results'}
                </Text>
              </YStack>
              <TSwitch
                checked={availability?.available || false}
                onCheckedChange={toggleAvailability}
                disabled={updateAvailabilityMutation.isPending}
              />
            </XStack>
          </CardContent>
        </Card>
        
        {/* Stats */}
        {statsLoading ? (
          <XStack gap="$3">
            <Skeleton flex={1} height={100} borderRadius="$4" />
            <Skeleton flex={1} height={100} borderRadius="$4" />
          </XStack>
        ) : (
          <>
            <XStack gap="$3">
              <Card flex={1}>
                <CardContent>
                  <YStack alignItems="center" gap="$1">
                    <Package size={24} color="$blue10" />
                    <Text fontSize="$6" fontWeight="700">{stats?.totalBundles || 0}</Text>
                    <Text fontSize="$2" color="$gray10">Bundles</Text>
                  </YStack>
                </CardContent>
              </Card>
              <Card flex={1}>
                <CardContent>
                  <YStack alignItems="center" gap="$1">
                    <Users size={24} color="$green10" />
                    <Text fontSize="$6" fontWeight="700">{stats?.totalClients || 0}</Text>
                    <Text fontSize="$2" color="$gray10">Clients</Text>
                  </YStack>
                </CardContent>
              </Card>
            </XStack>
            
            <XStack gap="$3">
              <Card flex={1}>
                <CardContent>
                  <YStack alignItems="center" gap="$1">
                    <DollarSign size={24} color="$green10" />
                    <Text fontSize="$6" fontWeight="700">
                      ${(stats?.totalEarnings || 0).toLocaleString()}
                    </Text>
                    <Text fontSize="$2" color="$gray10">Earnings</Text>
                  </YStack>
                </CardContent>
              </Card>
              <Card flex={1}>
                <CardContent>
                  <YStack alignItems="center" gap="$1">
                    <CheckCircle size={24} color="$purple10" />
                    <Text fontSize="$6" fontWeight="700">{stats?.completedDeliveries || 0}</Text>
                    <Text fontSize="$2" color="$gray10">Deliveries</Text>
                  </YStack>
                </CardContent>
              </Card>
            </XStack>
          </>
        )}
        
        {/* Profile Completion */}
        {profile?.profileCompletion !== undefined && profile.profileCompletion < 100 && (
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <YStack gap="$3">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="$3" color="$gray10">Profile completion</Text>
                  <Text fontSize="$3" fontWeight="600">{profile.profileCompletion}%</Text>
                </XStack>
                <Progress value={profile.profileCompletion} />
                
                {profile.missingFields?.length > 0 && (
                  <YStack gap="$2" marginTop="$2">
                    <Text fontSize="$2" color="$gray10">Missing information:</Text>
                    {profile.missingFields.map((field: string) => (
                      <XStack key={field} alignItems="center" gap="$2">
                        <AlertCircle size={14} color="$yellow10" />
                        <Text fontSize="$2" color="$gray10">{field}</Text>
                      </XStack>
                    ))}
                  </YStack>
                )}
                
                <Button
                  variant="outline"
                  onPress={() => router.push('/trainer/edit-profile')}
                >
                  Complete Profile
                </Button>
              </YStack>
            </CardContent>
          </Card>
        )}
        
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <XStack justifyContent="space-between" alignItems="center">
              <CardTitle>Contact Information</CardTitle>
              <Button 
                size="sm" 
                variant="ghost"
                icon={<Edit size={16} />}
                onPress={() => router.push('/trainer/edit-profile')}
              >
                Edit
              </Button>
            </XStack>
          </CardHeader>
          <CardContent>
            <YStack gap="$3">
              <XStack alignItems="center" gap="$3">
                <Mail size={18} color="$gray10" />
                <Text>{profile?.email || user?.email || 'Not set'}</Text>
              </XStack>
              
              {profile?.phone && (
                <XStack alignItems="center" gap="$3">
                  <Phone size={18} color="$gray10" />
                  <Text>{profile.phone}</Text>
                </XStack>
              )}
              
              {profile?.location && (
                <XStack alignItems="center" gap="$3">
                  <MapPin size={18} color="$gray10" />
                  <Text>{profile.location}</Text>
                </XStack>
              )}
              
              {profile?.website && (
                <XStack alignItems="center" gap="$3">
                  <Globe size={18} color="$gray10" />
                  <Text color="$blue10">{profile.website}</Text>
                </XStack>
              )}
            </YStack>
          </CardContent>
        </Card>
        
        {/* Social Links */}
        {(profile?.instagram || profile?.twitter) && (
          <Card>
            <CardHeader>
              <CardTitle>Social Media</CardTitle>
            </CardHeader>
            <CardContent>
              <XStack gap="$3">
                {profile?.instagram && (
                  <Button variant="outline" icon={<Instagram size={18} />}>
                    Instagram
                  </Button>
                )}
                {profile?.twitter && (
                  <Button variant="outline" icon={<Twitter size={18} />}>
                    Twitter
                  </Button>
                )}
              </XStack>
            </CardContent>
          </Card>
        )}
        
        {/* Bio */}
        {profile?.bio && (
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <Text color="$gray11">{profile.bio}</Text>
            </CardContent>
          </Card>
        )}
        
        {/* Certifications */}
        {profile?.certifications?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Certifications</CardTitle>
            </CardHeader>
            <CardContent>
              <YStack gap="$2">
                {profile.certifications.map((cert: string, index: number) => (
                  <XStack key={index} alignItems="center" gap="$2">
                    <CheckCircle size={16} color="$green10" />
                    <Text>{cert}</Text>
                  </XStack>
                ))}
              </YStack>
            </CardContent>
          </Card>
        )}
        
        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <YStack gap="$2">
              <Button
                variant="outline"
                onPress={() => router.push('/trainer/settings')}
              >
                Account Settings
              </Button>
              <Button
                variant="outline"
                onPress={() => router.push('/trainer/payout-settings')}
              >
                Payout Settings
              </Button>
              <Button
                variant="outline"
                onPress={() => router.push('/trainer/notifications')}
              >
                Notification Preferences
              </Button>
            </YStack>
          </CardContent>
        </Card>
      </YStack>
    </ScrollView>
  );
}
