import type { AccessContext, DashboardGrant, DashboardPermission, KitDashboard } from './types';

const permissionWeight: Record<DashboardPermission, number> = { view: 1, edit: 2, admin: 3 };

export function hasDashboardAccess(context: AccessContext, dashboard: KitDashboard, grants: DashboardGrant[], required: DashboardPermission = 'view') {
  const adminRoles = context.adminRoles ?? ['admin'];
  if (adminRoles.includes(context.currentUser.role) || dashboard.ownerId === context.currentUser.id) return true;
  const grant = grants.find((item) => item.dashboardId === dashboard.id && item.userId === context.currentUser.id);
  return Boolean(grant && permissionWeight[grant.permission] >= permissionWeight[required]);
}

export function createId(prefix: string) {
  return `${prefix}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}
