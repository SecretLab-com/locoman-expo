import { logEvent } from "@/lib/logger";

export type LaunchEventName =
  | "trainer_home_next_action_tapped"
  | "trainer_invite_sent"
  | "trainer_offer_created"
  | "trainer_offer_published"
  | "trainer_offer_submitted_for_review"
  | "trainer_payment_link_created"
  | "trainer_tap_to_pay_started"
  | "trainer_tap_to_pay_completed"
  | "trainer_first_payment_received";

export function trackLaunchEvent(name: LaunchEventName, context?: Record<string, unknown>) {
  logEvent(`launch.${name}`, context);
}

