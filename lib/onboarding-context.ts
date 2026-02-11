import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_CONTEXT_KEY = "locomotivate_onboarding_context";

export type PendingOnboardingContext = {
  trainerId: string | null;
  inviteToken: string | null;
  createdAt: string;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function savePendingOnboardingContext(input: {
  trainerId?: string | null;
  inviteToken?: string | null;
}): Promise<void> {
  const trainerId = normalizeString(input.trainerId);
  const inviteToken = normalizeString(input.inviteToken);

  if (!trainerId && !inviteToken) {
    await clearPendingOnboardingContext();
    return;
  }

  const payload: PendingOnboardingContext = {
    trainerId,
    inviteToken,
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(ONBOARDING_CONTEXT_KEY, JSON.stringify(payload));
}

export async function getPendingOnboardingContext(): Promise<PendingOnboardingContext | null> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingOnboardingContext>;
    const trainerId = normalizeString(parsed.trainerId);
    const inviteToken = normalizeString(parsed.inviteToken);
    if (!trainerId && !inviteToken) {
      await clearPendingOnboardingContext();
      return null;
    }
    return {
      trainerId,
      inviteToken,
      createdAt: normalizeString(parsed.createdAt) ?? new Date().toISOString(),
    };
  } catch {
    await clearPendingOnboardingContext();
    return null;
  }
}

export async function clearPendingOnboardingContext(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_CONTEXT_KEY);
}
