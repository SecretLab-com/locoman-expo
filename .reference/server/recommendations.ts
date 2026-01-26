/**
 * Intelligent Recommendations Service
 * Provides ML-powered product and bundle suggestions based on:
 * - Client goals and preferences
 * - Purchase history
 * - Calendar events and schedule patterns
 * - Trainer performance data
 * - Geolocation context
 */

import { invokeLLM } from "./_core/llm";

interface ClientContext {
  clientId: number;
  goals: string[];
  purchaseHistory: Array<{ productId: number; productName: string; purchaseDate: Date }>;
  upcomingEvents: Array<{ type: string; startTime: Date; location?: string }>;
  currentLocation?: { lat: number; lng: number };
  trainerId?: number;
}

interface ProductRecommendation {
  productId: number;
  productName: string;
  reason: string;
  confidence: number;
  timing?: string;
  contextType: "pre_workout" | "post_workout" | "nutrition" | "recovery" | "general";
}

interface BundleRecommendation {
  templateId: number;
  templateName: string;
  reason: string;
  confidence: number;
  suggestedPrice: number;
  suggestedProducts: string[];
}

/**
 * Generate context-aware product recommendations
 * Analyzes client's schedule, location, and goals to suggest timely products
 */
export async function getContextAwareRecommendations(
  context: ClientContext
): Promise<ProductRecommendation[]> {
  const recommendations: ProductRecommendation[] = [];
  const now = new Date();

  // Check for upcoming gym appointments (within 2 hours)
  const upcomingGymSession = context.upcomingEvents.find((event) => {
    const timeDiff = event.startTime.getTime() - now.getTime();
    const hoursUntil = timeDiff / (1000 * 60 * 60);
    return (
      hoursUntil > 0 &&
      hoursUntil <= 2 &&
      (event.type === "training" || event.type === "session")
    );
  });

  if (upcomingGymSession) {
    recommendations.push({
      productId: 123457, // Pre-Workout Energy
      productName: "Pre-Workout Energy",
      reason: `You have a training session in ${Math.round(
        (upcomingGymSession.startTime.getTime() - now.getTime()) / (1000 * 60)
      )} minutes. Boost your performance with pre-workout!`,
      confidence: 0.92,
      timing: "Take 30 minutes before your session",
      contextType: "pre_workout",
    });
  }

  // Check for recently completed sessions (within 1 hour)
  const recentSession = context.upcomingEvents.find((event) => {
    const timeDiff = now.getTime() - event.startTime.getTime();
    const hoursAgo = timeDiff / (1000 * 60 * 60);
    return (
      hoursAgo > 0 &&
      hoursAgo <= 1 &&
      (event.type === "training" || event.type === "session")
    );
  });

  if (recentSession) {
    recommendations.push({
      productId: 123460, // BCAA Recovery
      productName: "BCAA Recovery",
      reason: "Great workout! Support your muscle recovery with BCAAs.",
      confidence: 0.88,
      timing: "Take within 30 minutes post-workout for best results",
      contextType: "post_workout",
    });
  }

  // Goal-based recommendations
  if (context.goals.includes("weight_loss")) {
    recommendations.push({
      productId: 123459, // Fat Burner
      productName: "Fat Burner",
      reason: "Based on your weight loss goals, this thermogenic can help boost metabolism.",
      confidence: 0.85,
      contextType: "general",
    });
  }

  if (context.goals.includes("strength") || context.goals.includes("power")) {
    recommendations.push({
      productId: 123458, // Creatine
      productName: "Creatine Monohydrate",
      reason: "Essential for strength and power gains. Consistent use shows best results.",
      confidence: 0.9,
      contextType: "general",
    });
  }

  if (context.goals.includes("longevity")) {
    recommendations.push({
      productId: 123462, // Omega-3
      productName: "Omega-3 Fish Oil",
      reason: "Supports heart health and cognitive function for long-term wellness.",
      confidence: 0.87,
      contextType: "general",
    });
  }

  // Time-of-day recommendations
  const hour = now.getHours();
  if (hour >= 6 && hour <= 10) {
    recommendations.push({
      productId: 123461, // Multivitamin
      productName: "Multivitamin Complex",
      reason: "Morning is the best time to take your daily vitamins with breakfast.",
      confidence: 0.75,
      timing: "Take with your morning meal",
      contextType: "nutrition",
    });
  }

  // Sort by confidence and return top recommendations
  return recommendations.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/**
 * Generate bundle composition recommendations using LLM
 * Analyzes client data to suggest optimal product combinations
 */
export async function getBundleCompositionRecommendations(
  trainerContext: {
    trainerId: number;
    clientGoals: string[];
    clientBudget?: number;
    availableProducts: Array<{ id: number; name: string; price: number; category: string }>;
    existingBundles?: Array<{ name: string; products: string[]; price: number }>;
  }
): Promise<BundleRecommendation[]> {
  try {
    const prompt = `You are a fitness supplement expert helping a trainer create optimal product bundles.

Client Goals: ${trainerContext.clientGoals.join(", ")}
Budget: ${trainerContext.clientBudget ? `$${trainerContext.clientBudget}` : "Flexible"}

Available Products:
${trainerContext.availableProducts.map((p) => `- ${p.name} ($${p.price}) - ${p.category}`).join("\n")}

${
  trainerContext.existingBundles
    ? `Existing Bundles (avoid duplicating):
${trainerContext.existingBundles.map((b) => `- ${b.name}: ${b.products.join(", ")} - $${b.price}`).join("\n")}`
    : ""
}

Suggest 3 unique bundle compositions that would best serve these client goals. For each bundle, provide:
1. A catchy name
2. 3-5 recommended products from the available list
3. A brief reason why this combination works
4. A suggested price point

Format your response as JSON array.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a fitness and nutrition expert. Respond only with valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "bundle_recommendations",
          strict: true,
          schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    products: { type: "array", items: { type: "string" } },
                    reason: { type: "string" },
                    suggestedPrice: { type: "number" },
                  },
                  required: ["name", "products", "reason", "suggestedPrice"],
                  additionalProperties: false,
                },
              },
            },
            required: ["recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return getDefaultBundleRecommendations(trainerContext.clientGoals);

    const parsed = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
    return parsed.recommendations.map((rec: any, index: number) => ({
      templateId: index + 1,
      templateName: rec.name,
      reason: rec.reason,
      confidence: 0.85 - index * 0.05,
      suggestedPrice: rec.suggestedPrice,
      suggestedProducts: rec.products,
    }));
  } catch (error) {
    console.error("[Recommendations] LLM error:", error);
    return getDefaultBundleRecommendations(trainerContext.clientGoals);
  }
}

/**
 * Default bundle recommendations when LLM is unavailable
 */
function getDefaultBundleRecommendations(goals: string[]): BundleRecommendation[] {
  const recommendations: BundleRecommendation[] = [];

  if (goals.includes("strength") || goals.includes("power")) {
    recommendations.push({
      templateId: 1,
      templateName: "Strength Builder Pro",
      reason: "Optimal combination for muscle growth and strength gains",
      confidence: 0.85,
      suggestedPrice: 149.99,
      suggestedProducts: ["Whey Protein Isolate", "Creatine Monohydrate", "Pre-Workout Energy"],
    });
  }

  if (goals.includes("weight_loss")) {
    recommendations.push({
      templateId: 2,
      templateName: "Lean & Mean Stack",
      reason: "Supports fat loss while preserving muscle mass",
      confidence: 0.82,
      suggestedPrice: 129.99,
      suggestedProducts: ["Fat Burner", "Plant Protein", "BCAA Recovery"],
    });
  }

  if (goals.includes("longevity")) {
    recommendations.push({
      templateId: 3,
      templateName: "Wellness Foundation",
      reason: "Complete daily nutrition for long-term health",
      confidence: 0.8,
      suggestedPrice: 99.99,
      suggestedProducts: ["Multivitamin Complex", "Omega-3 Fish Oil", "Plant Protein"],
    });
  }

  // Always add a general recommendation
  recommendations.push({
    templateId: 4,
    templateName: "Essential Starter Kit",
    reason: "Perfect introduction to supplementation for any fitness goal",
    confidence: 0.75,
    suggestedPrice: 89.99,
    suggestedProducts: ["Plant Protein", "Multivitamin Complex", "BCAA Recovery"],
  });

  return recommendations.slice(0, 3);
}

/**
 * Analyze trainer performance and suggest pricing strategies
 */
export async function getPricingRecommendations(
  trainerData: {
    trainerId: number;
    bundlesSold: number;
    averagePrice: number;
    conversionRate: number;
    competitorPrices?: number[];
  }
): Promise<{
  recommendedPrice: number;
  priceRange: { min: number; max: number };
  reasoning: string;
}> {
  // Simple pricing algorithm based on performance data
  let basePrice = trainerData.averagePrice;

  // Adjust based on conversion rate
  if (trainerData.conversionRate > 0.15) {
    // High conversion - can increase price
    basePrice *= 1.1;
  } else if (trainerData.conversionRate < 0.05) {
    // Low conversion - consider lowering price
    basePrice *= 0.9;
  }

  // Consider competitor prices if available
  if (trainerData.competitorPrices && trainerData.competitorPrices.length > 0) {
    const avgCompetitor =
      trainerData.competitorPrices.reduce((a, b) => a + b, 0) /
      trainerData.competitorPrices.length;
    // Position slightly below average competitor
    basePrice = Math.min(basePrice, avgCompetitor * 0.95);
  }

  // Round to .99
  const recommendedPrice = Math.round(basePrice) - 0.01;

  return {
    recommendedPrice,
    priceRange: {
      min: Math.round(recommendedPrice * 0.8),
      max: Math.round(recommendedPrice * 1.2),
    },
    reasoning:
      trainerData.conversionRate > 0.1
        ? "Your strong conversion rate suggests room for premium pricing."
        : "Competitive pricing recommended to improve conversion rates.",
  };
}

/**
 * Generate predictive retail prompts based on schedule and location
 */
export function generatePredictivePrompts(
  context: ClientContext
): Array<{ message: string; productId: number; priority: "high" | "medium" | "low" }> {
  const prompts: Array<{ message: string; productId: number; priority: "high" | "medium" | "low" }> = [];
  const now = new Date();

  // Check upcoming events
  for (const event of context.upcomingEvents) {
    const hoursUntil = (event.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (event.type === "training" || event.type === "session") {
      if (hoursUntil > 0 && hoursUntil <= 2) {
        prompts.push({
          message: `🏋️ Training in ${Math.round(hoursUntil * 60)} min! Fuel up with pre-workout?`,
          productId: 123457,
          priority: "high",
        });
      } else if (hoursUntil > 2 && hoursUntil <= 24) {
        prompts.push({
          message: `📅 Training tomorrow - make sure you're stocked up on essentials`,
          productId: 123456,
          priority: "medium",
        });
      }
    }

    if (event.type === "delivery") {
      if (hoursUntil > 0 && hoursUntil <= 4) {
        prompts.push({
          message: `📦 Your delivery is coming soon! Track your order.`,
          productId: 0,
          priority: "high",
        });
      }
    }
  }

  // Time-based prompts
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  // Monday motivation
  if (dayOfWeek === 1 && hour >= 6 && hour <= 10) {
    prompts.push({
      message: "💪 New week, new goals! Start strong with your supplements.",
      productId: 123461,
      priority: "medium",
    });
  }

  // Weekend recovery
  if ((dayOfWeek === 6 || dayOfWeek === 0) && hour >= 10 && hour <= 14) {
    prompts.push({
      message: "🧘 Weekend recovery time - don't forget your BCAAs!",
      productId: 123460,
      priority: "low",
    });
  }

  return prompts.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export type {
  ClientContext,
  ProductRecommendation,
  BundleRecommendation,
};
