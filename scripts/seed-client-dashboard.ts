import "dotenv/config";

import {
  createDelivery,
  createOrder,
  createOrderItem,
  getOrdersByClient,
  getUserByOpenId,
  upsertUser,
} from "../server/db";

async function ensureUser({
  openId,
  email,
  name,
  role,
}: {
  openId: string;
  email: string;
  name: string;
  role: "client" | "trainer";
}) {
  await upsertUser({
    openId,
    email,
    name,
    role,
    loginMethod: "email",
  });
  const user = await getUserByOpenId(openId);
  if (!user) {
    throw new Error(`Failed to resolve user for ${openId}`);
  }
  return user;
}

async function seed() {
  const client = await ensureUser({
    openId: "test_client_account",
    email: "client@secretlab.com",
    name: "Test Client",
    role: "client",
  });

  const trainer = await ensureUser({
    openId: "test_trainer_account",
    email: "trainer@secretlab.com",
    name: "Test Trainer",
    role: "trainer",
  });

  const existingOrders = await getOrdersByClient(client.id);
  if (existingOrders.length >= 2) {
    console.log("[Seed] Client already has orders; skipping.");
    return;
  }

  const activeOrderId = await createOrder({
    clientId: client.id,
    trainerId: trainer.id,
    customerEmail: client.email ?? "client@secretlab.com",
    customerName: client.name ?? "Test Client",
    totalAmount: "149.99",
    subtotalAmount: "139.99",
    taxAmount: "10.00",
    shippingAmount: "0.00",
    status: "processing",
    fulfillmentStatus: "unfulfilled",
    paymentStatus: "paid",
    fulfillmentMethod: "trainer_delivery",
    orderData: {
      imageUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400",
    },
  });

  const activeOrderItemId = await createOrderItem({
    orderId: activeOrderId,
    name: "Performance Bundle",
    quantity: 1,
    price: "149.99",
    totalPrice: "149.99",
    fulfillmentStatus: "unfulfilled",
  });

  await createDelivery({
    orderId: activeOrderId,
    orderItemId: activeOrderItemId,
    trainerId: trainer.id,
    clientId: client.id,
    productName: "Performance Bundle Kit",
    quantity: 1,
    status: "scheduled",
    scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    deliveryMethod: "in_person",
    notes: "Trainer scheduled delivery.",
  });

  const deliveredOrderId = await createOrder({
    clientId: client.id,
    trainerId: trainer.id,
    customerEmail: client.email ?? "client@secretlab.com",
    customerName: client.name ?? "Test Client",
    totalAmount: "89.00",
    subtotalAmount: "79.00",
    taxAmount: "10.00",
    shippingAmount: "0.00",
    status: "delivered",
    fulfillmentStatus: "fulfilled",
    paymentStatus: "paid",
    fulfillmentMethod: "trainer_delivery",
    deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    orderData: {
      imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400",
    },
  });

  const deliveredOrderItemId = await createOrderItem({
    orderId: deliveredOrderId,
    name: "Recovery Bundle",
    quantity: 1,
    price: "89.00",
    totalPrice: "89.00",
    fulfillmentStatus: "fulfilled",
  });

  await createDelivery({
    orderId: deliveredOrderId,
    orderItemId: deliveredOrderItemId,
    trainerId: trainer.id,
    clientId: client.id,
    productName: "Recovery Bundle Kit",
    quantity: 1,
    status: "delivered",
    deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    deliveryMethod: "in_person",
    notes: "Delivered by trainer.",
  });

  console.log("[Seed] Inserted client dashboard orders and deliveries.");
}

seed().catch((error) => {
  console.error("[Seed] Failed:", error);
  process.exit(1);
});
