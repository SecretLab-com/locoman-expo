import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trackLaunchEvent } from "@/lib/analytics";
import { formatGBPFromMinor, toMinorUnits } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";

type OfferType = "one_off_session" | "multi_session_package" | "product_bundle";
type PaymentType = "one_off" | "recurring";
type OfferStatus = "draft" | "in_review" | "published" | "archived";
type TemplateCandidate = {
  id: string;
  title: string;
  description?: string | null;
  goalType?: string | null;
  basePrice?: string | null;
  imageUrl?: string | null;
  defaultServices?: unknown;
  defaultProducts?: unknown;
  goalsJson?: unknown;
  totalTrainerBonus?: number;
  isPromoted?: boolean;
};

const OFFER_TYPES: Array<{ value: OfferType; label: string; subtitle: string }> = [
  { value: "one_off_session", label: "One-off session", subtitle: "Single session payment" },
  { value: "multi_session_package", label: "Multi-session package", subtitle: "Bundle multiple sessions" },
  { value: "product_bundle", label: "Product bundle", subtitle: "Sell grouped products" },
];

const PAYMENT_TYPES: Array<{ value: PaymentType; label: string; subtitle: string }> = [
  { value: "one_off", label: "One-off", subtitle: "Single payment" },
  { value: "recurring", label: "Recurring", subtitle: "Ongoing monthly payment" },
];

function showAlert(title: string, message: string) {
  Alert.alert(title, message);
}

function parseArrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toTemplateLineItems(value: unknown): string[] {
  return parseArrayValue(value)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const candidate = record.title ?? record.name ?? record.label;
        return typeof candidate === "string" ? candidate.trim() : "";
      }
      return "";
    })
    .filter((item) => item.length > 0);
}

function normalizeSpecialty(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function toPositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolveTemplateSessionCount(template: TemplateCandidate): number | null {
  const goals =
    template.goalsJson && typeof template.goalsJson === "object"
      ? (template.goalsJson as Record<string, unknown>)
      : {};
  const goalCountRaw = Number(goals.sessionCount ?? 0);
  if (Number.isFinite(goalCountRaw) && goalCountRaw > 0) {
    return Math.floor(goalCountRaw);
  }

  const serviceCount = parseArrayValue(template.defaultServices).reduce<number>((sum, item) => {
    if (!item || typeof item !== "object") return sum;
    const record = item as Record<string, unknown>;
    const sessionsRaw = Number(record.sessions ?? record.quantity ?? record.count ?? 1);
    if (!Number.isFinite(sessionsRaw) || sessionsRaw <= 0) return sum + 1;
    return sum + Math.floor(sessionsRaw);
  }, 0);
  return serviceCount > 0 ? serviceCount : null;
}

export default function OfferWizardScreen() {
  const colors = useColors();
  const { id, templateId: templateIdParam } = useLocalSearchParams<{ id?: string; templateId?: string }>();
  const isEditMode = Boolean(id);
  const hasTemplateDeepLink = Boolean(templateIdParam) && !isEditMode;
  const [step, setStep] = useState(() => hasTemplateDeepLink ? 2 : 1);
  const [type, setType] = useState<OfferType>("one_off_session");
  const [priceInput, setPriceInput] = useState("");
  const [includedInput, setIncludedInput] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("one_off");
  const [sessionCountInput, setSessionCountInput] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Array<{ id: string; name: string; price: string; imageUrl?: string | null; quantity: number }>>([]);

  const { data: profileData } = trpc.profile.get.useQuery();
  const { data: templatesData = [], isLoading: templatesLoading } = trpc.bundles.templates.useQuery(undefined, {
    enabled: !isEditMode,
  });

  const { data: offerData, isLoading: loadingOffer } = trpc.offers.get.useQuery(
    { id: id || "" },
    { enabled: isEditMode && !!id },
  );

  useEffect(() => {
    if (!offerData) return;
    setType(offerData.type as OfferType);
    setPaymentType(offerData.paymentType as PaymentType);
    setPriceInput(((offerData.priceMinor || 0) / 100).toFixed(2));
    setTitle(offerData.title || "");
    setDescription(offerData.description || "");
    setIncludedInput((offerData.included || []).join("\n"));
    setSessionCountInput(offerData.sessionCount ? String(offerData.sessionCount) : "");
  }, [offerData]);

  const createOffer = trpc.offers.create.useMutation();
  const updateOffer = trpc.offers.update.useMutation();
  const submitForReviewOffer = trpc.offers.submitForReview.useMutation();

  const isSubmitting = createOffer.isPending || updateOffer.isPending || submitForReviewOffer.isPending;
  const included = useMemo(
    () =>
      includedInput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    [includedInput],
  );

  const totalSteps = isEditMode ? 5 : 6;
  const stepTitle = `Step ${step} of ${totalSteps}`;
  const templateCandidates = templatesData as TemplateCandidate[];
  const trainerSpecialties = useMemo(() => {
    const raw = profileData?.specialties;
    if (Array.isArray(raw)) {
      return raw
        .filter((value): value is string => typeof value === "string")
        .map(normalizeSpecialty)
        .filter(Boolean);
    }
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((value): value is string => typeof value === "string")
            .map(normalizeSpecialty)
            .filter(Boolean);
        }
      } catch {
        return [];
      }
    }
    return [];
  }, [profileData?.specialties]);
  const recommendedTemplates = useMemo(() => {
    if (!trainerSpecialties.length) return templateCandidates;
    const recommended = templateCandidates.filter((template) => {
      const goal = typeof template.goalType === "string" ? normalizeSpecialty(template.goalType) : "";
      return goal ? trainerSpecialties.includes(goal) : false;
    });
    return recommended.length > 0 ? recommended : templateCandidates;
  }, [templateCandidates, trainerSpecialties]);

  const applyTemplate = async (template: TemplateCandidate) => {
    await haptics.light();
    setSelectedTemplateId(template.id);
    const services = toTemplateLineItems(template.defaultServices);
    const products = toTemplateLineItems(template.defaultProducts);
    const goals = toTemplateLineItems(template.goalsJson);
    const combinedIncluded = [...services, ...products, ...goals];
    const dedupedIncluded = Array.from(new Set(combinedIncluded));
    const nextType: OfferType =
      products.length > 0
        ? "product_bundle"
        : services.length > 1
          ? "multi_session_package"
          : "one_off_session";

    setTitle(template.title || "");
    setDescription(template.description || "");
    if (template.basePrice) {
      const parsedPrice = Number.parseFloat(template.basePrice);
      if (Number.isFinite(parsedPrice) && parsedPrice > 0) {
        setPriceInput(parsedPrice.toFixed(2));
      }
    }
    setType(nextType);
    setIncludedInput(dedupedIncluded.join("\n"));
    const templateSessionCount = resolveTemplateSessionCount(template);
    setSessionCountInput(templateSessionCount ? String(templateSessionCount) : "");

    const templateProducts = parseArrayValue(template.defaultProducts);
    if (templateProducts.length > 0) {
      setSelectedProducts(templateProducts.map((p: any) => ({
        id: String(p.productId || p.id || ""),
        name: String(p.name || p.title || "Product"),
        price: String(p.price || "0"),
        imageUrl: p.imageUrl || null,
        quantity: Number(p.quantity) || 1,
      })));
    }
  };

  useEffect(() => {
    if (!hasTemplateDeepLink || !templateIdParam || templatesLoading) return;
    if (selectedTemplateId) return;
    const match = templateCandidates.find((t) => t.id === templateIdParam);
    if (match) {
      void applyTemplate(match);
      setStep(2);
    }
  }, [hasTemplateDeepLink, templateIdParam, templatesLoading, templateCandidates, selectedTemplateId]);

  const nextStep = async () => {
    await haptics.light();
    if (step === 1 && !isEditMode && !selectedTemplateId) {
      // Allow continuing with a blank template, but keep an explicit user action.
      setSelectedTemplateId("scratch");
    }
    if ((isEditMode && step === 2) || (!isEditMode && step === 3)) {
      const value = parseFloat(priceInput);
      if (!value || value <= 0) {
        showAlert("Price required", "Enter a valid GBP price.");
        return;
      }
    }
    const isPaymentStep = (isEditMode && step === 4) || (!isEditMode && step === 5);
    const needsSessionCount = type === "multi_session_package" || paymentType === "recurring";
    if (isPaymentStep && needsSessionCount && !toPositiveInt(sessionCountInput)) {
      showAlert("Session count required", "Add how many sessions are included per package/cycle.");
      return;
    }
    if (step === totalSteps) return;
    setStep((s) => s + 1);
  };

  const previousStep = async () => {
    await haptics.light();
    if (step === 1) {
      router.back();
      return;
    }
    setStep((s) => s - 1);
  };

  const upsertOffer = async (submitForReview: boolean) => {
    const amount = parseFloat(priceInput || "0");
    if (!title.trim()) {
      showAlert("Title required", "Add an offer title before continuing.");
      return;
    }
    if (!amount || amount <= 0) {
      showAlert("Price required", "Enter a valid GBP price.");
      return;
    }
    const needsSessionCount = type === "multi_session_package" || paymentType === "recurring";
    const resolvedSessionCount = needsSessionCount ? toPositiveInt(sessionCountInput) : null;
    if (needsSessionCount && !resolvedSessionCount) {
      showAlert("Session count required", "Add how many sessions are included per package/cycle.");
      return;
    }

    const productsForPayload = selectedProducts.map((p) => ({
      id: p.id,
      productId: p.id,
      name: p.name,
      price: p.price,
      imageUrl: p.imageUrl,
      quantity: p.quantity,
    }));

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      priceMinor: toMinorUnits(amount),
      included,
      productsJson: productsForPayload.length > 0 ? productsForPayload : undefined,
      sessionCount: resolvedSessionCount || undefined,
      paymentType,
      publish: false,
    };

    try {
      let offerId = id;
      if (isEditMode && id) {
        await updateOffer.mutateAsync({ id, ...payload });
      } else {
        const created = await createOffer.mutateAsync(payload);
        offerId = created.id;
        trackLaunchEvent("trainer_offer_created", { type, paymentType, priceMinor: payload.priceMinor });
      }

      if (submitForReview && offerId) {
        await submitForReviewOffer.mutateAsync({ id: offerId });
        trackLaunchEvent("trainer_offer_submitted_for_review", {
          offerId,
          type,
          paymentType,
          priceMinor: payload.priceMinor,
        });
      }

      await haptics.success();
      router.replace("/(trainer)/offers" as any);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save offer.";
      showAlert("Offer error", message);
    }
  };

  if (isEditMode && loadingOffer) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-2 pb-4">
          <Text className="text-sm text-muted">{stepTitle}</Text>
          <Text className="text-2xl font-bold text-foreground mt-1">{isEditMode ? "Edit Offer" : "Create Offer"}</Text>
        </View>

        <View className="px-4 pb-8">
          <View className="bg-surface border border-border rounded-xl p-4 mb-4">
            <Text className="text-sm font-medium text-muted mb-2">Offer title</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. 10 Session Strength Package"
              placeholderTextColor={colors.muted}
            />
            <Text className="text-sm font-medium text-muted mb-2">Description (optional)</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
              value={description}
              onChangeText={setDescription}
              placeholder="What is included?"
              placeholderTextColor={colors.muted}
            />
          </View>

          {!isEditMode && step === 1 && (
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-semibold text-foreground">1. Browse templates</Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTemplateId("scratch");
                    setTitle("");
                    setDescription("");
                    setPriceInput("");
                    setIncludedInput("");
                    setSessionCountInput("");
                    setType("one_off_session");
                    setPaymentType("one_off");
                    setStep(2);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Start from scratch"
                  testID="offer-template-scratch"
                >
                  <Text className="text-primary text-sm font-medium">Start from scratch</Text>
                </TouchableOpacity>
              </View>
              {trainerSpecialties.length > 0 ? (
                <Text className="text-xs text-muted mb-3">
                  Recommended for: {trainerSpecialties.map((value) => value.replaceAll("_", " ")).join(", ")}
                </Text>
              ) : null}
              {templatesLoading ? (
                <View className="bg-surface border border-border rounded-xl p-4">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : recommendedTemplates.length === 0 ? (
                <View className="bg-surface border border-border rounded-xl p-4">
                  <Text className="text-muted">No templates available yet. Continue with Start from scratch.</Text>
                </View>
              ) : (
                recommendedTemplates.map((template) => {
                  const isSelected = selectedTemplateId === template.id;
                  const goalLabel = template.goalType ? template.goalType.replaceAll("_", " ") : null;
                  const serviceCount = parseArrayValue(template.defaultServices).length;
                  const productCount = parseArrayValue(template.defaultProducts).length;
                  const bonus = (template as any).totalTrainerBonus as number | undefined;

                  return (
                    <TouchableOpacity
                      key={template.id}
                      className={`bg-surface border rounded-2xl mb-3 overflow-hidden ${isSelected ? "border-primary border-2" : "border-border"}`}
                      onPress={() => {
                        void applyTemplate(template);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${template.title} template`}
                      testID={`offer-template-${template.id}`}
                    >
                      {template.imageUrl ? (
                        <Image
                          source={{ uri: template.imageUrl }}
                          style={{ width: "100%", height: 140 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={{ width: "100%", height: 80, backgroundColor: `${colors.primary}12` }}
                          className="items-center justify-center"
                        >
                          <IconSymbol name="bag.fill" size={32} color={`${colors.primary}40`} />
                        </View>
                      )}
                      <View className="p-4">
                        <View className="flex-row items-start justify-between mb-1">
                          <Text className="text-foreground font-semibold text-base flex-1 pr-3">{template.title}</Text>
                          {goalLabel && (
                            <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: `${colors.primary}18`, borderWidth: 1, borderColor: `${colors.primary}40` }}>
                              <Text className="text-[11px] font-semibold capitalize" style={{ color: colors.primary }}>{goalLabel}</Text>
                            </View>
                          )}
                        </View>
                        {template.description ? (
                          <Text className="text-sm text-muted mt-1" numberOfLines={2}>{template.description}</Text>
                        ) : null}
                        <View className="flex-row items-center flex-wrap gap-x-4 gap-y-1 mt-3">
                          {template.basePrice ? (
                            <View className="flex-row items-center">
                              <IconSymbol name="dollarsign.circle.fill" size={13} color={colors.success} />
                              <Text className="text-xs text-muted ml-1">From {template.basePrice} GBP</Text>
                            </View>
                          ) : null}
                          {serviceCount > 0 && (
                            <View className="flex-row items-center">
                              <IconSymbol name="calendar" size={13} color={colors.muted} />
                              <Text className="text-xs text-muted ml-1">{serviceCount} {serviceCount === 1 ? "service" : "services"}</Text>
                            </View>
                          )}
                          {productCount > 0 && (
                            <View className="flex-row items-center">
                              <IconSymbol name="bag.fill" size={13} color={colors.muted} />
                              <Text className="text-xs text-muted ml-1">{productCount} {productCount === 1 ? "product" : "products"}</Text>
                            </View>
                          )}
                        </View>
                        {bonus && bonus > 0 ? (
                          <View className="mt-2 bg-success/10 rounded-lg px-3 py-2 flex-row items-center">
                            <IconSymbol name="star.fill" size={14} color={colors.success} />
                            <Text className="text-xs font-semibold ml-1.5" style={{ color: colors.success }}>
                              +${bonus.toFixed(2)} trainer bonus per sale
                            </Text>
                          </View>
                        ) : null}
                        {isSelected && (
                          <View className="mt-2 flex-row items-center">
                            <IconSymbol name="checkmark" size={14} color={colors.primary} />
                            <Text className="text-xs font-semibold ml-1" style={{ color: colors.primary }}>Selected</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {((isEditMode && step === 1) || (!isEditMode && step === 2)) && (
            <View className="mb-4">
              <Text className="text-base font-semibold text-foreground mb-3">{isEditMode ? "1. Offer type" : "2. Offer type"}</Text>
              {OFFER_TYPES.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  className={`bg-surface border rounded-xl p-4 mb-2 ${type === option.value ? "border-primary" : "border-border"}`}
                  onPress={() => setType(option.value)}
                >
                  <Text className="text-foreground font-semibold">{option.label}</Text>
                  <Text className="text-sm text-muted mt-1">{option.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {((isEditMode && step === 2) || (!isEditMode && step === 3)) && (
            <View className="mb-4">
              <Text className="text-base font-semibold text-foreground mb-3">{isEditMode ? "2. Price" : "3. Price"}</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-lg font-bold"
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {((isEditMode && step === 3) || (!isEditMode && step === 4)) && (
            <View className="mb-4">
              <Text className="text-base font-semibold text-foreground mb-3">{isEditMode ? "3. What’s included" : "4. What’s included"}</Text>
              <TouchableOpacity
                className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4 flex-row items-center"
                onPress={() => router.push({ pathname: "/bundle-editor/new", params: { templateId: selectedTemplateId || undefined } } as any)}
                accessibilityRole="button"
                accessibilityLabel="Open product browser"
                testID="offer-open-bundle-editor"
              >
                <IconSymbol name="bag.fill" size={22} color={colors.primary} />
                <View className="flex-1 ml-3">
                  <Text className="text-foreground font-semibold">Browse &amp; add products</Text>
                  <Text className="text-muted text-xs mt-0.5">Open the full product catalog with search, filters, and barcode scanner</Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.primary} />
              </TouchableOpacity>

              <Text className="text-sm font-medium text-muted mb-2">Services &amp; other items</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground min-h-[100px]"
                value={includedInput}
                onChangeText={setIncludedInput}
                placeholder={"One item per line\nWarm-up session\nNutrition guide"}
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          {((isEditMode && step === 4) || (!isEditMode && step === 5)) && (
            <View className="mb-4">
              <Text className="text-base font-semibold text-foreground mb-3">{isEditMode ? "4. Payment type" : "5. Payment type"}</Text>
              {PAYMENT_TYPES.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  className={`bg-surface border rounded-xl p-4 mb-2 ${paymentType === option.value ? "border-primary" : "border-border"}`}
                  onPress={() => setPaymentType(option.value)}
                >
                  <Text className="text-foreground font-semibold">{option.label}</Text>
                  <Text className="text-sm text-muted mt-1">{option.subtitle}</Text>
                </TouchableOpacity>
              ))}
              {(type === "multi_session_package" || paymentType === "recurring") ? (
                <View className="mt-3">
                  <Text className="text-sm font-medium text-muted mb-2">
                    {paymentType === "recurring" ? "Sessions per billing cycle" : "Total sessions in package"}
                  </Text>
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    value={sessionCountInput}
                    onChangeText={setSessionCountInput}
                    placeholder="e.g. 8"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                  />
                </View>
              ) : null}
            </View>
          )}

          {((isEditMode && step === 5) || (!isEditMode && step === 6)) && (
            <View className="mb-4">
              <Text className="text-base font-semibold text-foreground mb-3">{isEditMode ? "5. Review" : "6. Review"}</Text>
              <View className="bg-surface border border-border rounded-xl p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-muted">Type</Text>
                  <Text className="text-foreground font-semibold">{type.replaceAll("_", " ")}</Text>
                </View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-muted">Price</Text>
                  <Text className="text-foreground font-semibold">
                    {formatGBPFromMinor(toMinorUnits(parseFloat(priceInput || "0")))}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-muted">Payment</Text>
                  <Text className="text-foreground font-semibold">{paymentType === "one_off" ? "One-off" : "Recurring"}</Text>
                </View>
                {(type === "multi_session_package" || paymentType === "recurring") ? (
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-muted">Sessions</Text>
                    <Text className="text-foreground font-semibold">{sessionCountInput || "Not set"}</Text>
                  </View>
                ) : null}
                <View className="mt-2 pt-2 border-t border-border">
                  <Text className="text-muted text-xs">{included.length} included item(s)</Text>
                  <Text className="text-muted text-xs mt-1">
                    {isEditMode && (offerData?.status as OfferStatus) === "in_review"
                      ? "This offer is currently in review."
                      : "Submitting sends this offer for manager/coordinator quality review."}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View className="flex-row items-center gap-2 mt-2">
            <TouchableOpacity
              className="bg-surface border border-border rounded-xl py-3 items-center px-4"
              style={step < totalSteps ? { flex: 1 } : { flex: 0.9 }}
              onPress={previousStep}
              accessibilityRole="button"
              accessibilityLabel={step === 1 ? "Cancel offer editing" : "Go back one step"}
              testID={step === 1 ? "offer-cancel" : "offer-back"}
            >
              <Text className="text-foreground font-semibold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
                {step === 1 ? "Cancel" : "Back"}
              </Text>
            </TouchableOpacity>

            {step < totalSteps ? (
              <TouchableOpacity className="flex-1 bg-primary rounded-xl py-3 items-center" onPress={nextStep}>
                <Text className="text-background font-semibold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>Next</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  className="bg-surface border border-border rounded-xl py-3 items-center px-4"
                  style={{ flex: 1.1 }}
                  onPress={() => upsertOffer(false)}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Save offer as draft"
                  testID="offer-save-draft"
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.foreground} />
                  ) : (
                    <Text className="text-foreground font-semibold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86}>
                      Save Draft
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-primary rounded-xl py-3 items-center px-4"
                  style={{ flex: 1.8 }}
                  onPress={() => upsertOffer(true)}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Submit offer for review"
                  testID="offer-submit-review"
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-background font-semibold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86}>
                      Submit for Review
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>

    </ScreenContainer>
  );
}

