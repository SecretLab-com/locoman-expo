import { useState, useMemo } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Calendar, 
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Video,
  MoreVertical,
  Edit,
  Trash,
  Check,
  X,
} from '@tamagui/lucide-icons';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/ui/Avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, MenuItem } from '@/components/ui/DropdownMenu';
import { SkeletonListItem } from '@/components/ui/Skeleton';
import { EmptyStateBox } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { trpc } from '@/lib/trpc';

// Session type colors
const sessionTypeColors: Record<string, string> = {
  'in-person': 'success',
  'virtual': 'info',
  'consultation': 'warning',
};

// Session item component
interface Session {
  id: string;
  clientName: string;
  clientAvatar?: string;
  clientId: string;
  type: 'in-person' | 'virtual' | 'consultation';
  startTime: string;
  endTime: string;
  location?: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
}

function SessionItem({ 
  session, 
  onPress,
  onEdit,
  onComplete,
  onCancel,
}: { 
  session: Session;
  onPress: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const startTime = new Date(session.startTime);
  const endTime = new Date(session.endTime);
  
  const timeString = `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

  return (
    <Card pressable onPress={onPress}>
      <CardContent>
        <XStack alignItems="flex-start" gap="$3">
          {/* Time indicator */}
          <YStack 
            width={60}
            alignItems="center"
            paddingTop="$1"
          >
            <Text fontSize="$5" fontWeight="700" color="$primary">
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric' })}
            </Text>
            <Text fontSize="$1" color="$mutedForeground">
              {startTime.toLocaleTimeString('en-US', { minute: '2-digit' })}
            </Text>
          </YStack>

          {/* Session details */}
          <YStack flex={1} gap="$2">
            <XStack alignItems="center" gap="$2">
              <UserAvatar src={session.clientAvatar} name={session.clientName} size="sm" />
              <Text fontSize="$4" fontWeight="600" color="$color">
                {session.clientName}
              </Text>
            </XStack>

            <XStack gap="$2" flexWrap="wrap">
              <Badge variant={sessionTypeColors[session.type] as any} size="sm">
                {session.type === 'virtual' && <Video size={12} />}
                {session.type}
              </Badge>
              <XStack alignItems="center" gap="$1">
                <Clock size={12} color="$mutedForeground" />
                <Text fontSize="$1" color="$mutedForeground">{timeString}</Text>
              </XStack>
            </XStack>

            {session.location && (
              <XStack alignItems="center" gap="$1">
                <MapPin size={12} color="$mutedForeground" />
                <Text fontSize="$2" color="$mutedForeground" numberOfLines={1}>
                  {session.location}
                </Text>
              </XStack>
            )}
          </YStack>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical size={20} color="$mutedForeground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <MenuItem
                icon={<Edit size={16} />}
                label="Edit Session"
                onPress={onEdit}
              />
              <MenuItem
                icon={<Check size={16} />}
                label="Mark Complete"
                onPress={onComplete}
              />
              <MenuItem
                icon={<X size={16} />}
                label="Cancel Session"
                onPress={onCancel}
                destructive
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </XStack>
      </CardContent>
    </Card>
  );
}

// Day selector component
function DaySelector({ 
  selectedDate, 
  onDateChange 
}: { 
  selectedDate: Date; 
  onDateChange: (date: Date) => void;
}) {
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = -3; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      result.push(date);
    }
    return result;
  }, []);

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.toDateString() === d2.toDateString();
  };

  return (
    <XStack gap="$2" justifyContent="space-between">
      {days.map((date) => {
        const isSelected = isSameDay(date, selectedDate);
        const isToday = isSameDay(date, new Date());
        
        return (
          <Button
            key={date.toISOString()}
            variant={isSelected ? 'default' : 'ghost'}
            onPress={() => onDateChange(date)}
            padding="$2"
            flex={1}
          >
            <YStack alignItems="center" gap="$0.5">
              <Text 
                fontSize="$1" 
                color={isSelected ? 'white' : '$mutedForeground'}
              >
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text 
                fontSize="$4" 
                fontWeight={isToday ? '700' : '500'}
                color={isSelected ? 'white' : '$color'}
              >
                {date.getDate()}
              </Text>
            </YStack>
          </Button>
        );
      })}
    </XStack>
  );
}

export default function TrainerSchedule() {
  const router = useRouter();
  const toast = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Format date for API
  const dateString = useMemo(() => {
    return selectedDate.toISOString().split('T')[0];
  }, [selectedDate]);

  // Fetch sessions for selected date
  const { 
    data: sessions, 
    isLoading,
    refetch,
  } = trpc.trainer.getSessionsByDate.useQuery({ date: dateString });

  // Update session mutation
  const updateSession = trpc.trainer.updateSession.useMutation({
    onSuccess: () => {
      toast.success('Session updated');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to update session', error.message);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleSessionPress = (sessionId: string) => {
    router.push(`/trainer/schedule/${sessionId}`);
  };

  const handleEditSession = (sessionId: string) => {
    router.push(`/trainer/schedule/${sessionId}/edit`);
  };

  const handleCompleteSession = (sessionId: string) => {
    updateSession.mutate({ sessionId, status: 'completed' });
  };

  const handleCancelSession = (sessionId: string) => {
    updateSession.mutate({ sessionId, status: 'cancelled' });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <YStack padding="$4" paddingBottom="$2" gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text fontSize="$7" fontWeight="700" color="$color">Schedule</Text>
              <Text fontSize="$3" color="$mutedForeground">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Text>
            </YStack>
            <Button 
              size="sm" 
              leftIcon={<Plus size={16} />}
              onPress={() => router.push('/trainer/schedule/new')}
            >
              Add
            </Button>
          </XStack>

          {/* Date Navigation */}
          <XStack alignItems="center" gap="$2">
            <Button variant="ghost" size="icon" onPress={() => navigateDate('prev')}>
              <ChevronLeft size={20} />
            </Button>
            <YStack flex={1}>
              <DaySelector 
                selectedDate={selectedDate} 
                onDateChange={setSelectedDate} 
              />
            </YStack>
            <Button variant="ghost" size="icon" onPress={() => navigateDate('next')}>
              <ChevronRight size={20} />
            </Button>
          </XStack>
        </YStack>

        {/* Sessions List */}
        <ScrollView
          flex={1}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {isLoading ? (
            <>
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </>
          ) : sessions?.length ? (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                onPress={() => handleSessionPress(session.id)}
                onEdit={() => handleEditSession(session.id)}
                onComplete={() => handleCompleteSession(session.id)}
                onCancel={() => handleCancelSession(session.id)}
              />
            ))
          ) : (
            <EmptyStateBox
              icon={<Calendar size={32} color="$mutedForeground" />}
              title="No sessions scheduled"
              description="You don't have any sessions scheduled for this day."
              action={{
                label: 'Schedule Session',
                onPress: () => router.push('/trainer/schedule/new'),
              }}
            />
          )}
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
