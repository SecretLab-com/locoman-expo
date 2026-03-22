import { logEvent } from "@/lib/logger";

export type LaunchEventName =
  | "trainer_home_next_action_tapped"
  | "trainer_invite_sent"
  | "trainer_client_created"
  | "trainer_add_client_bundle_deferred"
  | "trainer_add_client_custom_plan_start"
  | "trainer_simple_proposal_invite_sent"
  | "trainer_bundle_created"
  | "trainer_bundle_published"
  | "trainer_bundle_submitted_for_review"
  | "trainer_payment_link_created"
  | "trainer_tap_to_pay_started"
  | "trainer_tap_to_pay_completed"
  | "trainer_first_payment_received";

export function trackLaunchEvent(name: LaunchEventName, context?: Record<string, unknown>) {
  logEvent(`launch.${name}`, context);
}

