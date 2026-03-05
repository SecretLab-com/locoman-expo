import 'dotenv/config';

import * as db from '../server/db';

type MinimalUser = {
  id: string;
  name: string | null;
  email: string | null;
};

type SeedBundlePair = {
  trainer: MinimalUser;
  templateId: string;
  offerId: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureSeedTrainers(): Promise<MinimalUser[]> {
  const existing = await db.getUsersWithFilters({
    role: 'trainer',
    status: 'active',
    limit: 20,
    offset: 0,
  });
  if (existing.users.length >= 2) {
    return existing.users.slice(0, 2).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }));
  }

  const nowIso = new Date().toISOString();
  const seedSpecs = [
    { openId: 'seed_campaign_demo_trainer_1', name: 'Campaign Demo Trainer 1', email: 'campaign.trainer1@loco.test' },
    { openId: 'seed_campaign_demo_trainer_2', name: 'Campaign Demo Trainer 2', email: 'campaign.trainer2@loco.test' },
  ];
  for (const spec of seedSpecs) {
    await db.upsertUser({
      openId: spec.openId,
      name: spec.name,
      email: spec.email,
      role: 'trainer',
      active: true,
      loginMethod: 'email',
      lastSignedIn: nowIso,
    });
  }

  const refreshed = await db.getUsersWithFilters({
    role: 'trainer',
    status: 'active',
    limit: 20,
    offset: 0,
  });
  return refreshed.users.slice(0, 2).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
  }));
}

async function ensureCampaignAccounts(createdBy: string | null) {
  const existing = await db.getUsersWithFilters({
    role: 'manager',
    status: 'active',
    limit: 1,
    offset: 0,
  });
  const fallbackCreator = createdBy || existing.users[0]?.id || null;
  const accountSpecs = [
    {
      name: 'HydraFuel',
      accountType: 'brand' as const,
      slug: 'hydrafuel',
      websiteUrl: 'https://example.com/hydrafuel',
      contactName: 'HydraFuel Partnerships',
      contactEmail: 'partners@hydrafuel.test',
      notes: 'Seeded campaign demo account',
    },
    {
      name: 'Peak Motion',
      accountType: 'brand' as const,
      slug: 'peak-motion',
      websiteUrl: 'https://example.com/peak-motion',
      contactName: 'Peak Motion Brand Team',
      contactEmail: 'brand@peakmotion.test',
      notes: 'Seeded campaign demo account',
    },
    {
      name: 'Downtown Athletics',
      accountType: 'customer' as const,
      slug: 'downtown-athletics',
      websiteUrl: 'https://example.com/downtown-athletics',
      contactName: 'Downtown Athletics Ops',
      contactEmail: 'ops@downtownathletics.test',
      notes: 'Seeded campaign demo account',
    },
  ];

  const accountIds: string[] = [];
  const allAccounts = await (db as any).listCampaignAccounts({
    activeOnly: false,
    accountType: 'all',
    limit: 500,
  });
  for (const spec of accountSpecs) {
    const match = allAccounts.find(
      (account: any) => account.name.trim().toLowerCase() === spec.name.trim().toLowerCase(),
    );
    if (match?.id) {
      accountIds.push(match.id);
      continue;
    }
    const created = await (db as any).createCampaignAccount({
      ...spec,
      active: true,
      createdBy: fallbackCreator,
    });
    if (created?.id) accountIds.push(created.id);
  }
  return accountIds;
}

async function ensureTemplateAndOfferForTrainer(
  trainer: MinimalUser,
  index: number,
): Promise<SeedBundlePair> {
  const trainerName = trainer.name || `Trainer ${index + 1}`;
  const titleBase = slugify(trainerName);
  const templateTitle = `Campaign Demo Template - ${trainerName}`;
  const offerTitle = `Campaign Demo Offer - ${trainerName}`;
  const marker = `[seed-campaign-demo:${titleBase}]`;

  const bundles = await db.getBundleDraftsByTrainer(trainer.id);
  let template = bundles.find((row) => row.title === templateTitle);
  if (!template) {
    const templateId = await db.createBundleDraft({
      trainerId: trainer.id,
      title: templateTitle,
      description: `${marker} Template used to demonstrate campaign account mapping.`,
      status: 'published',
      price: '199.00',
      cadence: 'monthly',
      goalsJson: ['visibility', 'lead_gen'],
      productsJson: [],
      servicesJson: [],
      selectionsJson: [],
      isTemplate: true,
      templateActive: true,
      templateVisibility: ['trainer', 'coordinator', 'manager'],
      totalTrainerBonus: '45.00',
    });
    template = (await db.getBundleDraftById(templateId)) as any;
  } else if (!template.isTemplate) {
    await db.promoteBundleToTemplate(template.id, {
      templateVisibility: ['trainer', 'coordinator', 'manager'],
      templateActive: true,
    });
    template = (await db.getBundleDraftById(template.id)) as any;
  }

  let offer = bundles.find((row) => row.title === offerTitle);
  if (!offer) {
    const offerId = await db.createBundleDraft({
      trainerId: trainer.id,
      title: offerTitle,
      description: `${marker} Offer generated from template for dashboard demo.`,
      status: 'published',
      price: '249.00',
      cadence: 'monthly',
      goalsJson: ['awareness', 'conversion'],
      productsJson: [],
      servicesJson: [],
      selectionsJson: [],
      totalTrainerBonus: '65.00',
    });
    offer = (await db.getBundleDraftById(offerId)) as any;
  }

  if (!template?.id || !offer?.id) {
    throw new Error(`Unable to resolve template/offer for trainer ${trainer.id}`);
  }

  return {
    trainer,
    templateId: template.id,
    offerId: offer.id,
  };
}

function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function seedCampaignDemo() {
  console.log('[CampaignDemoSeed] Starting campaign demo seed...');

  const managerUsers = await db.getUsersWithFilters({
    role: 'manager',
    status: 'active',
    limit: 1,
    offset: 0,
  });
  const coordinatorUsers = await db.getUsersWithFilters({
    role: 'coordinator',
    status: 'active',
    limit: 1,
    offset: 0,
  });
  const createdBy = managerUsers.users[0]?.id || coordinatorUsers.users[0]?.id || null;

  const trainers = await ensureSeedTrainers();
  if (trainers.length < 2) {
    throw new Error('Need at least 2 active trainers to seed campaign demo data.');
  }
  console.log(`[CampaignDemoSeed] Using trainers: ${trainers.map((t) => t.email || t.id).join(', ')}`);

  const accountIds = await ensureCampaignAccounts(createdBy);
  if (accountIds.length < 2) {
    throw new Error('Need at least 2 campaign accounts to continue.');
  }
  console.log(`[CampaignDemoSeed] Account IDs: ${accountIds.join(', ')}`);

  const pairs: SeedBundlePair[] = [];
  for (let i = 0; i < trainers.length; i += 1) {
    const pair = await ensureTemplateAndOfferForTrainer(trainers[i], i);
    pairs.push(pair);
  }

  for (const pair of pairs) {
    await (db as any).setCampaignAccountsForTemplate(pair.templateId, [
      {
        campaignAccountId: accountIds[0],
        relationType: 'brand',
        allocationPct: '70.00',
        metadata: { source: 'seed-campaign-demo' },
      },
      {
        campaignAccountId: accountIds[2] || accountIds[1],
        relationType: 'customer',
        allocationPct: '30.00',
        metadata: { source: 'seed-campaign-demo' },
      },
    ]);
    await (db as any).copyCampaignAccountsFromTemplateToBundle({
      templateBundleId: pair.templateId,
      bundleDraftId: pair.offerId,
    });
  }

  let upsertedRows = 0;
  for (let trainerIdx = 0; trainerIdx < pairs.length; trainerIdx += 1) {
    const pair = pairs[trainerIdx];
    const links = await (db as any).getCampaignAccountsForBundle(pair.offerId);
    for (let day = 0; day < 14; day += 1) {
      const date = isoDateDaysAgo(day);
      for (let linkIdx = 0; linkIdx < links.length; linkIdx += 1) {
        const link = links[linkIdx];
        const base = 1200 + (13 - day) * 75 + trainerIdx * 210 + linkIdx * 95;
        const views = base;
        const engagements = Math.round(views * (0.085 + linkIdx * 0.01));
        const clicks = Math.round(views * (0.023 + trainerIdx * 0.003));
        const shareSaves = Math.round(views * 0.011);
        const requiredPosts = 2;
        const postsDelivered = day % 3 === 0 ? 2 : 1;
        const postsOnTime = postsDelivered === 2 ? 2 : 1;

        await (db as any).upsertTrainerCampaignMetricDaily({
          trainerId: pair.trainer.id,
          bundleDraftId: pair.offerId,
          campaignAccountId: link.campaignAccountId,
          metricDate: date,
          platform: day % 2 === 0 ? 'instagram' : 'youtube',
          followers: 15000 + trainerIdx * 2300 + linkIdx * 400,
          views,
          engagements,
          clicks,
          shareSaves,
          postsDelivered,
          postsOnTime,
          requiredPosts,
          requiredTagPosts: requiredPosts,
          approvedCreativePosts: postsDelivered,
          metadata: {
            source: 'seed-campaign-demo',
            seedVersion: 1,
          },
        });
        upsertedRows += 1;
      }
    }
  }

  console.log('[CampaignDemoSeed] Complete.');
  console.log(
    JSON.stringify(
      {
        trainers: pairs.map((pair) => ({
          trainerId: pair.trainer.id,
          trainerName: pair.trainer.name,
          templateId: pair.templateId,
          offerId: pair.offerId,
        })),
        campaignAccountCount: accountIds.length,
        metricRowsUpserted: upsertedRows,
      },
      null,
      2,
    ),
  );
}

seedCampaignDemo().catch((error) => {
  console.error('[CampaignDemoSeed] Failed:', error);
  process.exit(1);
});
