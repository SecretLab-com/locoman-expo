import { NavigationHeader } from "@/components/navigation-header";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LOCO_ASSISTANT_NAME, LOCO_ASSISTANT_USER_ID } from "@/shared/const";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { getRoleConversationPath } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

type Recipient = {
  id: string;
  name: string;
  subtitle?: string;
  photoUrl?: string | null;
};

type MessageGroup = {
  id: string;
  name: string;
  icon: string;
  memberIds: string[];
  createdAt: string;
};

type NewMessageMode = "default" | "group-select" | "group-details";

const GROUP_ICON_OPTIONS = [
  "person.2.fill",
  "message.fill",
  "star.fill",
  "bolt.fill",
  "heart.fill",
];

export default function NewMessageScreen() {
  const colors = useColors();
  const { effectiveRole, isManager, isCoordinator, user } = useAuthContext();
  const canManage = isManager || isCoordinator;
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<NewMessageMode>("default");
  const [groupIcon, setGroupIcon] = useState(GROUP_ICON_OPTIONS[0]);
  const [groups, setGroups] = useState<MessageGroup[]>([]);

  const managersQuery = trpc.admin.usersWithFilters.useQuery(
    { limit: 50, offset: 0, search: searchQuery || undefined },
    { enabled: canManage }
  );
  const trainerClientsQuery = trpc.clients.list.useQuery(undefined, {
    enabled: effectiveRole === "trainer",
  });
  const clientTrainersQuery = trpc.myTrainers.list.useQuery(undefined, {
    enabled: effectiveRole === "client",
  });
  const catalogTrainersQuery = trpc.catalog.trainers.useQuery(undefined, {
    enabled: effectiveRole === "shopper" || !effectiveRole,
  });

  useEffect(() => {
    if (recipientId) {
      const parsed = Array.isArray(recipientId) ? recipientId[0] : recipientId;
      if (parsed) {
        setSelectedIds(new Set([parsed]));
        setMode("default");
      }
    }
  }, [recipientId]);

  const groupsStorageKey = user?.id ? `messageGroups:${user.id}` : "messageGroups:anon";
  useEffect(() => {
    if (!user?.id) return;
    const loadGroups = async () => {
      const stored = await AsyncStorage.getItem(groupsStorageKey);
      if (!stored) {
        setGroups([]);
        return;
      }
      try {
        setGroups(JSON.parse(stored) as MessageGroup[]);
      } catch {
        setGroups([]);
      }
    };
    loadGroups();
  }, [groupsStorageKey, user?.id]);

  const recipients: Recipient[] = useMemo(() => {
    if (canManage) {
      return (managersQuery.data?.users ?? []).map((u) => ({
        id: String(u.id),
        name: u.name || "Unknown",
        subtitle: u.email || u.role,
        photoUrl: u.photoUrl,
      }));
    }
    if (effectiveRole === "trainer") {
      const clientRecipients = (trainerClientsQuery.data ?? []).map((c: any) => ({
        id: String(c.userId || c.id),
        name: c.name || "Client",
        subtitle: c.email || "Client",
        photoUrl: c.photoUrl,
      }));
      return [
        {
          id: LOCO_ASSISTANT_USER_ID,
          name: LOCO_ASSISTANT_NAME,
          subtitle: "AI automation assistant",
          photoUrl: null,
        },
        ...clientRecipients,
      ];
    }
    if (effectiveRole === "client") {
      return (clientTrainersQuery.data ?? []).map((t: any) => ({
        id: String(t.id),
        name: t.name || "Trainer",
        subtitle: t.email || "Trainer",
        photoUrl: t.photoUrl,
      }));
    }
    return (catalogTrainersQuery.data ?? []).map((t: any) => ({
      id: String(t.id),
      name: t.name || "Trainer",
      subtitle: t.email || "Trainer",
      photoUrl: t.photoUrl,
    }));
  }, [
    canManage,
    managersQuery.data,
    trainerClientsQuery.data,
    clientTrainersQuery.data,
    catalogTrainersQuery.data,
    effectiveRole,
  ]);

  const filteredRecipients = recipients.filter((recipient) =>
    recipient.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMembers = recipients.filter((recipient) => selectedIds.has(recipient.id));
  const canProceedToDetails = selectedIds.size >= 2;
  const canCreateGroup = groupName.trim().length > 0 && selectedIds.size >= 2;

  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openDirectMessage = (recipient: Recipient) => {
    if (!user?.id) return;
    if (effectiveRole === "trainer" && recipient.id === LOCO_ASSISTANT_USER_ID) {
      router.push("/(trainer)/assistant" as any);
      return;
    }
    const conversationId =
      recipient.id === LOCO_ASSISTANT_USER_ID
        ? `bot-${user.id}`
        : [user.id, recipient.id].sort().join("-");
    const name = recipient.name || "User";
    router.push({
      pathname: getRoleConversationPath(effectiveRole as any) as any,
      params: {
        id: conversationId,
        participantId: recipient.id,
        name,
      },
    });
  };

  const openGroupChat = (group: MessageGroup) => {
    router.push({
      pathname: getRoleConversationPath(effectiveRole as any) as any,
      params: {
        id: group.id,
        participantIds: group.memberIds.join(","),
        name: group.name,
        groupIcon: group.icon,
      },
    });
  };

  const handleCreateGroup = async () => {
    if (!canCreateGroup || !user?.id) return;
    const ids = Array.from(selectedIds);
    await haptics.light();
    const newGroup: MessageGroup = {
      id: `group-${user.id}-${Date.now()}`,
      name: groupName.trim(),
      icon: groupIcon,
      memberIds: ids,
      createdAt: new Date().toISOString(),
    };
    const nextGroups = [newGroup, ...groups];
    await AsyncStorage.setItem(groupsStorageKey, JSON.stringify(nextGroups));
    setGroups(nextGroups);
    setMode("default");
    setGroupName("");
    setGroupIcon(GROUP_ICON_OPTIONS[0]);
    setSelectedIds(new Set());
    openGroupChat(newGroup);
  };

  return (
    <ScreenContainer>
      <NavigationHeader
        title={
          mode === "group-select"
            ? "New group"
            : mode === "group-details"
              ? "Group details"
              : "New message"
        }
        showBack
        showHome
        onBack={() => {
          if (mode === "group-details") {
            setMode("group-select");
            return;
          }
          if (mode === "group-select") {
            setMode("default");
            setSelectedIds(new Set());
            return;
          }
          router.back();
        }}
        rightAction={
          mode === "group-select"
            ? {
                icon: "chevron.right",
                onPress: () => {
                  if (!canProceedToDetails) return;
                  setMode("group-details");
                },
                label: "Next",
                testID: "group-next",
              }
            : mode === "group-details"
              ? {
                  icon: "checkmark",
                  onPress: handleCreateGroup,
                  label: "Create group",
                  testID: "group-create",
                }
              : undefined
        }
      />
      {mode !== "group-details" && (
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
            <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
            <TextInput
              className="flex-1 ml-3 text-foreground"
              placeholder="Search recipients..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      )}

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {managersQuery.isLoading && canManage ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-muted mt-3">Loading...</Text>
          </View>
        ) : (
          <>
            {mode === "default" && (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setMode("group-select");
                    setSelectedIds(new Set());
                  }}
                  className="flex-row items-center py-3 border-b border-border"
                  accessibilityRole="button"
                  accessibilityLabel="Start a new group"
                  testID="message-new-group"
                >
                  <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3 overflow-hidden">
                    <IconSymbol name="person.2.fill" size={18} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">New group</Text>
                    <Text className="text-xs text-muted mt-0.5">Select multiple people</Text>
                  </View>
                </TouchableOpacity>

                {groups.length > 0 && (
                  <View className="pt-3 pb-1">
                    <Text className="text-xs font-semibold text-muted">Groups</Text>
                  </View>
                )}
                {groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    onPress={() => openGroupChat(group)}
                    className="flex-row items-center py-3 border-b border-border"
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${group.name}`}
                    testID={`message-group-${group.id}`}
                  >
                    <View className="w-10 h-10 rounded-full bg-muted/30 items-center justify-center mr-3 overflow-hidden">
                      <IconSymbol name={group.icon as any} size={18} color={colors.muted} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">{group.name}</Text>
                      <Text className="text-xs text-muted mt-0.5">
                        {group.memberIds.length} members
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {filteredRecipients.map((recipient) => (
                  <TouchableOpacity
                    key={recipient.id}
                    onPress={() => openDirectMessage(recipient)}
                    className="flex-row items-center py-3 border-b border-border"
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${recipient.name}`}
                    testID={`message-recipient-${recipient.id}`}
                  >
                    <View className="w-10 h-10 rounded-full bg-muted/30 items-center justify-center mr-3 overflow-hidden">
                      {recipient.id === LOCO_ASSISTANT_USER_ID ? (
                        <IconSymbol name="sparkles" size={18} color={colors.primary} />
                      ) : recipient.photoUrl ? (
                        <Image
                          source={{ uri: recipient.photoUrl }}
                          className="w-10 h-10 rounded-full"
                          contentFit="cover"
                        />
                      ) : (
                        <IconSymbol name="person.fill" size={18} color={colors.muted} />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">{recipient.name}</Text>
                      {recipient.subtitle && (
                        <Text className="text-xs text-muted mt-0.5">{recipient.subtitle}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {mode === "group-select" && (
              <>
                {filteredRecipients
                  .filter((recipient) => recipient.id !== LOCO_ASSISTANT_USER_ID)
                  .map((recipient) => {
                  const isSelected = selectedIds.has(recipient.id);
                  return (
                    <TouchableOpacity
                      key={recipient.id}
                      onPress={() => toggleRecipient(recipient.id)}
                      className="flex-row items-center py-3 border-b border-border"
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${recipient.name}`}
                      testID={`group-recipient-${recipient.id}`}
                    >
                      <View className="w-10 h-10 rounded-full bg-muted/30 items-center justify-center mr-3 overflow-hidden">
                        {recipient.photoUrl ? (
                          <Image
                            source={{ uri: recipient.photoUrl }}
                            className="w-10 h-10 rounded-full"
                            contentFit="cover"
                          />
                        ) : (
                          <IconSymbol name="person.fill" size={18} color={colors.muted} />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">{recipient.name}</Text>
                        {recipient.subtitle && (
                          <Text className="text-xs text-muted mt-0.5">{recipient.subtitle}</Text>
                        )}
                      </View>
                      <View
                        className="w-5 h-5 rounded-full border"
                        style={{
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primary : "transparent",
                        }}
                      />
                    </TouchableOpacity>
                  );
                })}
                <Text className="text-xs text-muted mt-3">
                  Select at least two people to continue.
                </Text>
              </>
            )}

            {mode === "group-details" && (
              <>
                <View className="mt-2">
                  <Text className="text-sm font-semibold text-muted mb-2">Group name</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    placeholder="e.g. Onboarding Team"
                    placeholderTextColor={colors.muted}
                    value={groupName}
                    onChangeText={setGroupName}
                  />
                </View>

                <View className="mt-4">
                  <Text className="text-sm font-semibold text-muted mb-2">Group icon</Text>
                  <View className="flex-row flex-wrap gap-3">
                    {GROUP_ICON_OPTIONS.map((icon) => {
                      const isSelected = groupIcon === icon;
                      return (
                        <TouchableOpacity
                          key={icon}
                          onPress={() => setGroupIcon(icon)}
                          className={`w-12 h-12 rounded-full items-center justify-center border ${
                            isSelected ? "border-primary bg-primary/10" : "border-border bg-surface"
                          }`}
                          accessibilityRole="button"
                          accessibilityLabel={`Choose ${icon} icon`}
                          testID={`group-icon-${icon}`}
                        >
                          <IconSymbol
                            name={icon as any}
                            size={18}
                            color={isSelected ? colors.primary : colors.muted}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View className="mt-4">
                  <Text className="text-sm font-semibold text-muted mb-2">
                    Members ({selectedMembers.length})
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {selectedMembers.map((member) => (
                      <View
                        key={member.id}
                        className="px-3 py-1 rounded-full bg-surface border border-border"
                      >
                        <Text className="text-xs text-foreground">{member.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleCreateGroup}
                  className="bg-primary rounded-full py-3 items-center mt-6"
                  accessibilityRole="button"
                  accessibilityLabel="Create group"
                  testID="group-create-button"
                  disabled={!canCreateGroup}
                  style={{ opacity: canCreateGroup ? 1 : 0.6 }}
                >
                  <Text className="text-background font-semibold">Create group</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
        <View className="h-10" />
      </ScrollView>
    </ScreenContainer>
  );
}
