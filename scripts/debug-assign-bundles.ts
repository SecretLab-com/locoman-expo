import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type DbUser = {
  id: string;
  email: string | null;
  role: string;
  name: string | null;
  active: boolean | null;
};

type BundleDraftRow = {
  id: string;
  trainer_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_source: string | null;
  price: string | null;
  cadence: string | null;
  selections_json: unknown;
  services_json: unknown;
  products_json: unknown;
  goals_json: unknown;
  status: string;
  shopify_product_id: number | null;
  shopify_variant_id: number | null;
};

const TARGET_TRAINER_EMAIL = "jason@secretlab.com";
const DEBUG_CLONES_PER_TRAINER = 2;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function clonePayloadFromBundle(
  source: BundleDraftRow,
  trainerId: string,
  trainerName: string,
  existingShopifyProductIds: Set<number>,
  existingShopifyVariantIds: Set<number>,
  sequence: number,
) {
  const nowSeed = Number(Date.now().toString().slice(-10));
  let syntheticShopifyProductId = nowSeed + sequence;
  while (existingShopifyProductIds.has(syntheticShopifyProductId)) {
    syntheticShopifyProductId += 1;
  }
  existingShopifyProductIds.add(syntheticShopifyProductId);

  let syntheticShopifyVariantId = syntheticShopifyProductId + 500000;
  while (existingShopifyVariantIds.has(syntheticShopifyVariantId)) {
    syntheticShopifyVariantId += 1;
  }
  existingShopifyVariantIds.add(syntheticShopifyVariantId);

  return {
    trainer_id: trainerId,
    template_id: null,
    title: `${source.title} (Debug - ${trainerName})`,
    description: source.description,
    image_url: source.image_url,
    image_source: source.image_source || "upload",
    price: source.price || "49.99",
    cadence: source.cadence || "one_time",
    selections_json: source.selections_json,
    services_json: source.services_json,
    products_json: source.products_json,
    goals_json: source.goals_json,
    suggested_goal: null,
    status: "published",
    shopify_product_id: syntheticShopifyProductId,
    shopify_variant_id: syntheticShopifyVariantId,
    submitted_for_review_at: null,
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    review_comments: "Debug clone for trainer catalog testing",
  };
}

async function main() {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("[Debug Bundles] Loading trainer users...");
  const { data: targetUserData, error: targetUserError } = await sb
    .from("users")
    .select("id, email, role, name, active")
    .eq("email", TARGET_TRAINER_EMAIL)
    .limit(1)
    .maybeSingle();
  if (targetUserError) throw targetUserError;

  const { data: trainers, error: trainersError } = await sb
    .from("users")
    .select("id, email, role, name, active")
    .eq("role", "trainer");
  if (trainersError) throw trainersError;
  const trainerUsers = (trainers || []) as DbUser[];
  const targetTrainer = (targetUserData as DbUser | null) || null;
  if (!targetTrainer) {
    throw new Error(`Trainer account not found: ${TARGET_TRAINER_EMAIL}`);
  }

  console.log("[Debug Bundles] Loading existing bundles...");
  const { data: allBundlesData, error: bundlesError } = await sb
    .from("bundle_drafts")
    .select(
      "id, trainer_id, title, description, image_url, image_source, price, cadence, selections_json, services_json, products_json, goals_json, status, shopify_product_id, shopify_variant_id",
    );
  if (bundlesError) throw bundlesError;
  const allBundles = (allBundlesData || []) as BundleDraftRow[];
  const existingShopifyProductIds = new Set<number>(
    allBundles
      .map((bundle) => bundle.shopify_product_id)
      .filter((value): value is number => Number.isInteger(value)),
  );
  const existingShopifyVariantIds = new Set<number>(
    allBundles
      .map((bundle) => bundle.shopify_variant_id)
      .filter((value): value is number => Number.isInteger(value)),
  );

  if (allBundles.length === 0) {
    console.log("[Debug Bundles] No bundles found. Nothing to update.");
    return;
  }

  const bundlesNeedingOwnerUpdate = allBundles.filter((bundle) => bundle.trainer_id !== targetTrainer.id);
  if (bundlesNeedingOwnerUpdate.length > 0) {
    const idsToUpdate = bundlesNeedingOwnerUpdate.map((bundle) => bundle.id);
    const { error: updateError } = await sb
      .from("bundle_drafts")
      .update({ trainer_id: targetTrainer.id })
      .in("id", idsToUpdate);
    if (updateError) throw updateError;
  }

  console.log(
    `[Debug Bundles] Reassigned ${bundlesNeedingOwnerUpdate.length} bundle(s) to ${TARGET_TRAINER_EMAIL}.`,
  );

  const otherTrainers = trainerUsers.filter((user) => user.id !== targetTrainer.id);
  if (otherTrainers.length === 0) {
    console.log("[Debug Bundles] No additional trainers found. Done.");
    return;
  }

  const sourceBundles = allBundles.slice(0, Math.max(DEBUG_CLONES_PER_TRAINER, 1));
  if (sourceBundles.length === 0) {
    console.log("[Debug Bundles] No source bundles available for cloning.");
    return;
  }

  let createdCloneCount = 0;
  let sequence = 1;

  for (const trainer of otherTrainers) {
    const trainerName = trainer.name || trainer.email || "Trainer";
    const payloads = sourceBundles
      .slice(0, DEBUG_CLONES_PER_TRAINER)
      .map((bundle) =>
        clonePayloadFromBundle(
          bundle,
          trainer.id,
          trainerName,
          existingShopifyProductIds,
          existingShopifyVariantIds,
          sequence++,
        ),
      );

    const { error: insertError } = await sb.from("bundle_drafts").insert(payloads);
    if (insertError) throw insertError;
    createdCloneCount += payloads.length;
    console.log(`[Debug Bundles] Created ${payloads.length} debug clone(s) for ${trainerName}.`);
  }

  console.log("[Debug Bundles] Complete.");
  console.log(
    `[Debug Bundles] Summary: reassigned=${bundlesNeedingOwnerUpdate.length}, createdClones=${createdCloneCount}, trainers=${otherTrainers.length}`,
  );
}

main().catch((error) => {
  console.error("[Debug Bundles] Failed:", error);
  process.exit(1);
});

