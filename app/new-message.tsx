import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";

type Contact = {
  id: number;
  name: string;
  avatar: string | null;
  role: string;
};

function ContactItem({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="flex-row items-center p-4 bg-surface border-b border-border"
      onPress={async () => {
        await haptics.light();
        onPress();
      }}
      activeOpacity={0.7}
    >
      {contact.avatar ? (
        <Image
          source={{ uri: contact.avatar }}
          className="w-12 h-12 rounded-full"
          contentFit="cover"
        />
      ) : (
        <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
          <IconSymbol name="person.fill" size={24} color={colors.primary} />
        </View>
      )}
      <View className="flex-1 ml-3">
        <Text className="text-foreground font-semibold">{contact.name}</Text>
        <Text className="text-sm text-muted capitalize">{contact.role}</Text>
      </View>
      <IconSymbol name="chevron.right" size={20} color={colors.muted} />
    </TouchableOpacity>
  );
}

export default function NewMessageScreen() {
  const colors = useColors();
  const { isTrainer, isClient } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch contacts based on role
  // Trainers see their clients, clients see their trainers
  const { data: clients, isLoading: clientsLoading } = trpc.clients.list.useQuery(undefined, {
    enabled: isTrainer,
  });

  const { data: trainers, isLoading: trainersLoading } = trpc.catalog.trainers.useQuery(undefined, {
    enabled: isClient || !isTrainer,
  });

  const isLoading = clientsLoading || trainersLoading;

  // Build contacts list based on role
  const contacts: Contact[] = isTrainer
    ? (clients || []).map((client: any) => ({
        id: client.id,
        name: client.name,
        avatar: client.avatar || null,
        role: "client",
      }))
    : (trainers || []).map((trainer: any) => ({
        id: trainer.id,
        name: trainer.name,
        avatar: trainer.avatar || null,
        role: "trainer",
      }));

  // Filter contacts by search query
  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );



  const handleContactPress = (contact: Contact) => {
    // Generate conversation ID and navigate to chat
    router.replace({
      pathname: "/conversation/[id]" as any,
      params: {
        id: `new-${contact.id}`,
        name: contact.name,
        participantId: contact.id.toString(),
      },
    });
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      {/* Navigation Header */}
      <NavigationHeader title="New Message" />

      {/* Search */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-surface rounded-xl px-4 py-3 border border-border">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 ml-3 text-foreground"
            placeholder={isTrainer ? "Search clients..." : "Search trainers..."}
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Contacts List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading contacts...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ContactItem contact={item} onPress={() => handleContactPress(item)} />
          )}
          ListEmptyComponent={
            <View className="items-center py-12 px-4">
              <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                <IconSymbol name="person.fill" size={32} color={colors.muted} />
              </View>
              <Text className="text-foreground font-semibold text-lg mb-1">
                {searchQuery ? "No results found" : "No contacts yet"}
              </Text>
              <Text className="text-muted text-center">
                {searchQuery
                  ? "Try a different search term"
                  : isTrainer
                  ? "Your clients will appear here"
                  : "Find a trainer to start chatting"
                }
              </Text>
            </View>
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </ScreenContainer>
  );
}
