import type { DesignTokens } from '@/design-system/tokens';

export type ManagedUserRole =
  | 'shopper'
  | 'client'
  | 'trainer'
  | 'manager'
  | 'coordinator';
export type ManagedUserStatus = 'active' | 'inactive';

export function getManagedUserRoleColors(tokens: DesignTokens) {
  return {
    shopper: tokens.colors.text.secondary,
    client: tokens.colors.brand.primary,
    trainer: tokens.colors.status.success,
    manager: tokens.colors.status.warning,
    coordinator: tokens.colors.status.accent,
  } satisfies Record<ManagedUserRole, string>;
}

export function getManagedUserStatusColors(tokens: DesignTokens) {
  return {
    active: tokens.colors.status.success,
    inactive: tokens.colors.status.error,
  } satisfies Record<ManagedUserStatus, string>;
}

export function getManagedUserActionColors(tokens: DesignTokens) {
  return {
    role_changed: tokens.colors.brand.primary,
    status_changed: tokens.colors.status.warning,
    impersonation_started: tokens.colors.status.accent,
    impersonation_ended: tokens.colors.status.accent,
    profile_updated: tokens.colors.status.success,
    invited: tokens.colors.status.info,
    deleted: tokens.colors.status.error,
  } as Record<string, string>;
}
