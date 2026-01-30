import { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

type InviteEntry = {
  email: string;
  name: string;
  valid: boolean;
};

type BulkInviteModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (invites: { email: string; name: string }[]) => Promise<void>;
  trainerId?: number;
};

export function BulkInviteModal({ visible, onClose, onSubmit }: BulkInviteModalProps) {
  const colors = useColors();
  const [inputMode, setInputMode] = useState<"manual" | "csv">("manual");
  const [manualInput, setManualInput] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [parsedInvites, setParsedInvites] = useState<InviteEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const parseManualInput = () => {
    const lines = manualInput.split("\n").filter((line) => line.trim());
    const entries: InviteEntry[] = [];
    for (const line of lines) {
      let email = "";
      let name = "";
      if (line.includes("<") && line.includes(">")) {
        const match = line.match(/^(.+?)\s*<(.+?)>$/);
        if (match) {
          name = match[1].trim();
          email = match[2].trim();
        }
      } else if (line.includes(",")) {
        const parts = line.split(",");
        email = parts[0].trim();
        name = parts.slice(1).join(",").trim();
      } else {
        email = line.trim();
        name = email.split("@")[0];
      }
      entries.push({ email, name, valid: validateEmail(email) });
    }
    setParsedInvites(entries);
  };

  const parseCsvContent = () => {
    const lines = csvContent.split("\n").filter((line) => line.trim());
    const entries: InviteEntry[] = [];
    const startIndex = lines[0]?.toLowerCase().includes("email") ? 1 : 0;
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      const email = parts[0] || "";
      const name = parts[1] || email.split("@")[0];
      entries.push({ email, name, valid: validateEmail(email) });
    }
    setParsedInvites(entries);
  };

  const handleParse = () => {
    if (inputMode === "manual") parseManualInput();
    else parseCsvContent();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeInvite = (index: number) => {
    setParsedInvites((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const validInvites = parsedInvites.filter((i) => i.valid);
    if (validInvites.length === 0) {
      Alert.alert("Error", "No valid email addresses to invite");
      return;
    }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onSubmit(validInvites.map((i) => ({ email: i.email, name: i.name })));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `${validInvites.length} invitations sent`, [{ text: "OK", onPress: handleClose }]);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to send invitations");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setManualInput("");
    setCsvContent("");
    setParsedInvites([]);
    setMessage("");
    onClose();
  };

  const validCount = parsedInvites.filter((i) => i.valid).length;
  const invalidCount = parsedInvites.filter((i) => !i.valid).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <TouchableOpacity onPress={handleClose}><Text className="text-primary">Cancel</Text></TouchableOpacity>
          <Text className="text-lg font-semibold text-foreground">Bulk Invite</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={validCount === 0 || isSubmitting} style={{ opacity: validCount === 0 || isSubmitting ? 0.5 : 1 }}>
            {isSubmitting ? <ActivityIndicator size="small" color={colors.primary} /> : <Text className="text-primary font-semibold">Send ({validCount})</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="flex-row mx-4 mt-4 bg-surface rounded-xl p-1">
            <TouchableOpacity onPress={() => setInputMode("manual")} className="flex-1 py-2 rounded-lg" style={{ backgroundColor: inputMode === "manual" ? colors.background : "transparent" }}>
              <Text className="text-center font-medium" style={{ color: inputMode === "manual" ? colors.foreground : colors.muted }}>Manual Entry</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setInputMode("csv")} className="flex-1 py-2 rounded-lg" style={{ backgroundColor: inputMode === "csv" ? colors.background : "transparent" }}>
              <Text className="text-center font-medium" style={{ color: inputMode === "csv" ? colors.foreground : colors.muted }}>Paste CSV</Text>
            </TouchableOpacity>
          </View>

          <View className="px-4 mt-4">
            {inputMode === "manual" ? (
              <View>
                <Text className="text-sm text-muted mb-2">Enter emails (one per line):</Text>
                <TextInput value={manualInput} onChangeText={setManualInput} placeholder={"john@example.com\njane@example.com, Jane Doe"} placeholderTextColor={colors.muted} multiline numberOfLines={8} className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground" style={{ minHeight: 160, textAlignVertical: "top" }} />
              </View>
            ) : (
              <View>
                <Text className="text-sm text-muted mb-2">Paste CSV content (email, name):</Text>
                <TextInput value={csvContent} onChangeText={setCsvContent} placeholder={"email,name\njohn@example.com,John Doe"} placeholderTextColor={colors.muted} multiline numberOfLines={8} className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground font-mono" style={{ minHeight: 160, textAlignVertical: "top" }} />
              </View>
            )}
            <TouchableOpacity onPress={handleParse} className="bg-primary py-3 rounded-xl mt-4" disabled={inputMode === "manual" ? !manualInput.trim() : !csvContent.trim()} style={{ opacity: (inputMode === "manual" ? !manualInput.trim() : !csvContent.trim()) ? 0.5 : 1 }}>
              <Text className="text-white text-center font-semibold">Parse Emails</Text>
            </TouchableOpacity>
          </View>

          <View className="px-4 mt-6">
            <Text className="text-sm font-medium text-muted mb-2">Invitation Message (optional)</Text>
            <TextInput value={message} onChangeText={setMessage} placeholder="Add a personal message..." placeholderTextColor={colors.muted} multiline numberOfLines={3} className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground" style={{ minHeight: 80, textAlignVertical: "top" }} />
          </View>

          {parsedInvites.length > 0 && (
            <View className="px-4 mt-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-foreground">Parsed ({parsedInvites.length})</Text>
                <View className="flex-row gap-2">
                  {validCount > 0 && <View className="bg-success/20 px-2 py-1 rounded"><Text className="text-success text-xs font-medium">{validCount} valid</Text></View>}
                  {invalidCount > 0 && <View className="bg-error/20 px-2 py-1 rounded"><Text className="text-error text-xs font-medium">{invalidCount} invalid</Text></View>}
                </View>
              </View>
              {parsedInvites.map((invite, index) => (
                <View key={index} className="flex-row items-center bg-surface border rounded-xl px-4 py-3 mb-2" style={{ borderColor: invite.valid ? colors.border : colors.error }}>
                  <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: invite.valid ? colors.success + "20" : colors.error + "20" }}>
                    <IconSymbol name={invite.valid ? "checkmark" : "xmark"} size={16} color={invite.valid ? colors.success : colors.error} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground font-medium">{invite.name}</Text>
                    <Text className="text-sm text-muted">{invite.email}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeInvite(index)} className="p-2"><IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} /></TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <View className="h-24" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
