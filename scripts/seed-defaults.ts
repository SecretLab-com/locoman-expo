import "dotenv/config";
import {
  createBundleTemplate,
  createClient,
  createDelivery,
  createOrder,
  createOrderItem,
  getUserByOpenId,
  upsertProduct,
  upsertUser,
} from "../server/db";

async function seed() {
  console.log("[Seed] Starting comprehensive default seeding...");

  // 1. Seed Core Superusers
  console.log("[Seed] Seeding core superusers...");
  const superusers = [
    {
      openId: "jason_secretlab_coordinator",
      name: "Jason",
      email: "jason@secretlab.com",
      role: "coordinator" as const,
    },
    {
      openId: "test_user_coordinator",
      name: "Test User",
      email: "testuser@secretlab.com",
      role: "coordinator" as const,
    }
  ];

  for (const user of superusers) {
    await upsertUser({
      ...user,
      loginMethod: "email",
      lastSignedIn: new Date(),
    });
    console.log(`[Seed] Upserted superuser: ${user.email}`);
  }

  // 2. Seed Trainers
  console.log("[Seed] Seeding trainers...");
  const trainers = [
    { name: "Avery Brooks", email: "avery@loco.test", specialty: "Strength & Powerlifting" },
    { name: "Jordan Lee", email: "jordan@loco.test", specialty: "Mobility & Recovery" },
    { name: "Morgan Chen", email: "morgan@loco.test", specialty: "Endurance & Conditioning" }
  ];

  const seededTrainers = [];
  for (let i = 0; i < trainers.length; i++) {
    const t = trainers[i];
    const openId = `seed_trainer_${i + 1}`;
    await upsertUser({
      openId,
      name: t.name,
      email: t.email,
      role: "trainer",
      loginMethod: "email",
      bio: `Professional coach specializing in ${t.specialty}.`,
      photoUrl: `https://i.pravatar.cc/150?img=${i + 1}`,
    });
    const user = await getUserByOpenId(openId);
    if (user) seededTrainers.push(user);
    console.log(`[Seed] Upserted trainer: ${t.email}`);
  }

  // 3. Seed Products
  console.log("[Seed] Seeding products...");
  const products = [
    { name: "Whey Protein Isolate", brand: "Optimum Nutrition", price: "59.99", category: "protein" as const },
    { name: "Creatine Monohydrate", brand: "Thorne", price: "35.00", category: "recovery" as const },
    { name: "Resistance Band Set", brand: "Rogue", price: "45.00", category: "strength" as const }
  ];

  for (const p of products) {
    await upsertProduct({
      name: p.name,
      brand: p.brand,
      price: p.price,
      availability: "available",
      category: p.category,
    });
    console.log(`[Seed] Upserted product: ${p.name}`);
  }

  // 4. Seed Bundle Templates
  console.log("[Seed] Seeding bundle templates...");
  await createBundleTemplate({
    title: "Starter Strength Kit", // Schema uses 'title' not 'name' for templates
    description: "Everything you need to start your strength journey.",
    basePrice: "120.00",
    goalType: "strength",
    active: true,
    rulesJson: { items: ["Protein", "Creatine", "Bands"] }
  });
  console.log("[Seed] Upserted bundle template.");

  // 5. Seed Clients & Orders
  console.log("[Seed] Seeding clients and orders...");
  const clients = [
    { name: "Test Client", email: "client@secretlab.com", openId: "test_client_account" },
    { name: "Nora Rivera", email: "nora@loco.test", openId: "seed_client_1" }
  ];

  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    await upsertUser({
      openId: c.openId,
      name: c.name,
      email: c.email,
      role: "client",
      loginMethod: "email",
      trainerId: seededTrainers[i % seededTrainers.length]?.id,
    });
    const clientUser = await getUserByOpenId(c.openId);

    if (clientUser) {
      await createClient({
        trainerId: seededTrainers[i % seededTrainers.length].id,
        userId: clientUser.id,
        name: clientUser.name || c.name,
        email: clientUser.email,
        status: "active",
      });
      console.log(`[Seed] Created client relationship for: ${c.email}`);
      const orderId = await createOrder({
        clientId: clientUser.id,
        trainerId: seededTrainers[0].id,
        customerEmail: clientUser.email || "",
        customerName: clientUser.name || "",
        totalAmount: "150.00",
        status: "processing",
        paymentStatus: "paid",
      });

      const orderItemId = await createOrderItem({
        orderId,
        name: "Starter Strength Kit",
        quantity: 1,
        price: "150.00",
        totalPrice: "150.00",
      });

      await createDelivery({
        orderId,
        orderItemId,
        trainerId: seededTrainers[0].id,
        clientId: clientUser.id,
        productName: "Starter Strength Bundle",
        quantity: 1,
        status: "scheduled",
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      console.log(`[Seed] Created order and delivery for client: ${c.email}`);
    }
  }

  console.log("[Seed] Done! Database populated with defaults.");
}

seed().catch(err => {
  console.error("[Seed] Error:", err);
  process.exit(1);
});
