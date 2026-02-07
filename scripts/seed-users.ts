import "dotenv/config";

import { getUserByOpenId, updateUser, upsertUser } from "../server/db";

type SeedRole = "trainer" | "manager" | "client";

const TRAINER_COUNT = 10;
const MANAGER_COUNT = 5;
const CLIENT_COUNT = 10;

const TRAINER_NAMES = [
  "Avery Brooks",
  "Jordan Lee",
  "Morgan Chen",
  "Riley Patel",
  "Casey Nguyen",
  "Taylor Reed",
  "Parker Hayes",
  "Quinn Rivera",
  "Jamie Park",
  "Rowan Diaz",
  "Blake Ellis",
  "Finley Cruz",
  "Sawyer Hall",
  "Emery Ross",
  "Reese Kim",
  "Shawn Ali",
  "Logan Fox",
  "Dakota Ward",
  "Cameron Stone",
  "Ari Bennett",
];

const MANAGER_NAMES = [
  "Harper Gray",
  "Sydney Cole",
  "Micah Lewis",
  "Payton Grant",
  "Noah Burke",
  "Sage Cooper",
  "Alex Monroe",
  "Kendall Price",
  "Jules Bryant",
  "Spencer Young",
];

const CLIENT_NAMES = [
  "Mila Carter",
  "Evan Brooks",
  "Isla Turner",
  "Liam Howard",
  "Aria Collins",
  "Elijah Foster",
  "Zoe Price",
  "Owen Bennett",
  "Nora Rivera",
  "Jack Murphy",
  "Chloe Rogers",
  "Asher Bailey",
  "Luna Powell",
  "Leo Simmons",
  "Ava Perry",
  "Mason Reed",
  "Ella Watson",
  "Caleb Griffin",
  "Maya Stone",
  "Theo Gray",
];

const TRAINER_SPECIALTIES = [
  ["strength", "powerlifting"],
  ["mobility", "injury_prevention"],
  ["endurance", "conditioning"],
  ["nutrition", "weight_loss"],
  ["athletic_performance", "speed"],
  ["bodybuilding", "hypertrophy"],
  ["cross_training", "functional_fitness"],
  ["yoga", "recovery"],
  ["hiit", "fat_loss"],
  ["sports_specific", "agility"],
];

const TRAINER_BIOS = [
  "Helping clients build strength and confidence through smart programming.",
  "Performance coach focused on mobility, longevity, and sustainable habits.",
  "Endurance specialist who loves getting clients race-ready.",
  "Nutrition-forward programming with a focus on body composition.",
  "Athletic performance training for speed, power, and resilience.",
  "Hypertrophy coach building balanced, functional physiques.",
  "Functional fitness coach for busy professionals.",
  "Yoga and recovery coach for mobility and stress relief.",
  "HIIT coach who keeps sessions energetic and effective.",
  "Sports-specific trainer focused on game-day readiness.",
];

const SOCIAL_LINKS = [
  { instagram: "https://instagram.com/locomotivate" },
  { instagram: "https://instagram.com/coach.fit" },
  { instagram: "https://instagram.com/strength.lab" },
  { instagram: "https://instagram.com/hiit.hub" },
  { instagram: "https://instagram.com/mobility.mind" },
];

function avatarUrl(index: number) {
  const imageId = (index % 70) + 1;
  return `https://i.pravatar.cc/150?img=${imageId}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

async function upsertSeedUser(role: SeedRole, index: number, name: string) {
  const base = slugify(name);
  const openId = `seed_${role}_${base}_${index + 1}`;
  const email = `${base}.${role}${index + 1}@seed.locomotivate.test`;
  const username = `${base}.${role}${index + 1}`;

  await upsertUser({
    openId,
    name,
    email,
    username,
    role,
    loginMethod: "email",
    photoUrl: avatarUrl(index + (role === "trainer" ? 0 : role === "manager" ? 20 : 40)),
    bio: role === "trainer" ? TRAINER_BIOS[index % TRAINER_BIOS.length] : null,
    specialties: role === "trainer" ? TRAINER_SPECIALTIES[index % TRAINER_SPECIALTIES.length] : null,
    socialLinks: role === "trainer" ? SOCIAL_LINKS[index % SOCIAL_LINKS.length] : null,
    metadata: {
      seed: true,
      role,
    },
    lastSignedIn: new Date().toISOString(),
  });

  const user = await getUserByOpenId(openId);
  if (!user) {
    throw new Error(`Failed to resolve seeded user for ${openId}`);
  }

  return user;
}

async function seed() {
  console.log("[Seed] Seeding trainers...");
  const trainers = [];
  for (let i = 0; i < Math.min(TRAINER_COUNT, TRAINER_NAMES.length); i += 1) {
    const trainer = await upsertSeedUser("trainer", i, TRAINER_NAMES[i]);
    trainers.push(trainer);
  }

  console.log("[Seed] Seeding managers...");
  for (let i = 0; i < Math.min(MANAGER_COUNT, MANAGER_NAMES.length); i += 1) {
    await upsertSeedUser("manager", i, MANAGER_NAMES[i]);
  }

  console.log("[Seed] Seeding clients...");
  for (let i = 0; i < Math.min(CLIENT_COUNT, CLIENT_NAMES.length); i += 1) {
    const client = await upsertSeedUser("client", i, CLIENT_NAMES[i]);
    const trainer = trainers[i % trainers.length];
    if (trainer) {
      await updateUser(client.id, { trainerId: trainer.id });
    }
  }

  console.log(
    `[Seed] Done. Trainers: ${Math.min(TRAINER_COUNT, TRAINER_NAMES.length)}, Managers: ${Math.min(MANAGER_COUNT, MANAGER_NAMES.length)}, Clients: ${Math.min(CLIENT_COUNT, CLIENT_NAMES.length)}.`,
  );
}

seed().catch((error) => {
  console.error("[Seed] Failed:", error);
  process.exit(1);
});
