import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";

function buildInviteSeenKey(inviteId: string) {
  return `social_program_invite_seen:${inviteId}`;
}

export async function maybeShowInviteCongrats(params: {
  inviteId: string;
  coordinatorName?: string | null;
}) {
  const inviteId = String(params.inviteId || "").trim();
  if (!inviteId) return;
  const storageKey = buildInviteSeenKey(inviteId);
  const alreadySeen = await AsyncStorage.getItem(storageKey);
  if (alreadySeen === "1") return;
  await AsyncStorage.setItem(storageKey, "1");
  const coordinatorLine = params.coordinatorName
    ? ` ${params.coordinatorName} invited you to join.`
    : "";
  Alert.alert(
    "Congratulations, you're invited!",
    `You have an exclusive invite to the Social Posts program.${coordinatorLine}`,
  );
}
