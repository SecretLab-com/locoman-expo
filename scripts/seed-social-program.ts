import "dotenv/config";
import {
  getActiveTrainerSocialCommitment,
  getLatestTrainerSocialProgress,
  getTrainerSocialMembership,
  getTrainerSocialProfile,
  listEligibleSocialTrainers,
  upsertTrainerSocialCommitment,
  upsertTrainerSocialCommitmentProgress,
  upsertTrainerSocialMembership,
  upsertTrainerSocialProfile,
} from "../server/db";

type SeedStats = {
  trainersScanned: number;
  membershipCreated: number;
  commitmentsCreated: number;
  progressCreated: number;
  profilesCreated: number;
  alreadyPresent: number;
  errors: number;
};

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start, end };
}

async function ensureTrainerSeeded(trainerId: string, invitedBy: string | null, stats: SeedStats) {
  let changed = false;

  const membership = await getTrainerSocialMembership(trainerId);
  if (!membership) {
    await upsertTrainerSocialMembership({
      trainerId,
      status: "invited",
      invitedBy,
      invitedAt: new Date().toISOString(),
      reason: "Backfilled by seed script",
    });
    stats.membershipCreated += 1;
    changed = true;
  }

  const commitment = await getActiveTrainerSocialCommitment(trainerId);
  if (!commitment) {
    await upsertTrainerSocialCommitment({
      trainerId,
      minimumFollowers: 10000,
      minimumPosts: 4,
      minimumOnTimePct: 95,
      minimumTagPct: 98,
      minimumApprovedCreativePct: 98,
      minimumAvgViews: 1000,
      minimumEngagementRate: 0.03,
      minimumCtr: 0.008,
      minimumShareSaveRate: 0.007,
      active: true,
      effectiveFrom: new Date().toISOString(),
    });
    stats.commitmentsCreated += 1;
    changed = true;
  }

  const activeCommitment = await getActiveTrainerSocialCommitment(trainerId);
  const latestProgress = await getLatestTrainerSocialProgress(trainerId);
  if (!latestProgress) {
    const { start, end } = currentMonthRange();
    await upsertTrainerSocialCommitmentProgress({
      trainerId,
      commitmentId: activeCommitment?.id || null,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      status: "on_track",
      postsDelivered: 0,
      postsRequired: activeCommitment?.minimumPosts || 4,
      onTimePct: 0,
      tagPct: 0,
      approvedCreativePct: 0,
      avgViews: 0,
      engagementRate: 0,
      ctr: 0,
      shareSaveRate: 0,
      notes: "Backfilled by seed script",
    });
    stats.progressCreated += 1;
    changed = true;
  }

  const profile = await getTrainerSocialProfile(trainerId);
  if (!profile) {
    await upsertTrainerSocialProfile({
      trainerId,
      phylloUserId: null,
      phylloAccountIds: [],
      platforms: [],
      followerCount: 0,
      avgViewsPerMonth: 0,
      avgEngagementRate: 0,
      avgCtr: 0,
      metadata: { seeded: true },
      lastSyncedAt: null,
    });
    stats.profilesCreated += 1;
    changed = true;
  }

  if (!changed) stats.alreadyPresent += 1;
}

async function seedSocialProgram() {
  const stats: SeedStats = {
    trainersScanned: 0,
    membershipCreated: 0,
    commitmentsCreated: 0,
    progressCreated: 0,
    profilesCreated: 0,
    alreadyPresent: 0,
    errors: 0,
  };

  console.log("[SocialSeed] Loading active trainers...");
  const trainers = await listEligibleSocialTrainers({ limit: 10000 });
  stats.trainersScanned = trainers.length;
  if (!trainers.length) {
    console.log("[SocialSeed] No active trainers found. Nothing to do.");
    return;
  }

  const inviterFallback = trainers.find((u) => u.role === "coordinator" || u.role === "manager")?.id || null;

  for (const trainer of trainers) {
    try {
      await ensureTrainerSeeded(trainer.id, inviterFallback, stats);
    } catch (error) {
      stats.errors += 1;
      console.error(`[SocialSeed] Failed trainer ${trainer.id} (${trainer.email || trainer.name || "unknown"}):`, error);
    }
  }

  console.log("[SocialSeed] Done.");
  console.log(
    JSON.stringify(
      {
        trainersScanned: stats.trainersScanned,
        membershipCreated: stats.membershipCreated,
        commitmentsCreated: stats.commitmentsCreated,
        progressCreated: stats.progressCreated,
        profilesCreated: stats.profilesCreated,
        alreadyPresent: stats.alreadyPresent,
        errors: stats.errors,
      },
      null,
      2,
    ),
  );

  if (stats.errors > 0) process.exitCode = 1;
}

seedSocialProgram().catch((error) => {
  console.error("[SocialSeed] Fatal error:", error);
  process.exit(1);
});
