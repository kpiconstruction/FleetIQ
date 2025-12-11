/**
 * RBAC permission checker for Fleet IQ backend functions
 */

export function hasPermission(user, permission) {
  const fleetRole = user?.fleet_role || 'Viewer';

  const permissions = {
    // Dashboard and view permissions
    viewMaintenanceDashboards: ['FleetAdmin', 'WorkshopOps', 'StateOps', 'Viewer'],
    
    // Template and plan management
    createMaintenanceTemplate: ['FleetAdmin'],
    editMaintenanceTemplate: ['FleetAdmin'],
    createMaintenancePlan: ['FleetAdmin'],
    editMaintenancePlan: ['FleetAdmin'],
    
    // Work order management
    createWorkOrder: ['FleetAdmin', 'WorkshopOps'],
    updateWorkOrder: ['FleetAdmin', 'WorkshopOps'],
    
    // Service history migration
    accessMigration: ['FleetAdmin', 'WorkshopOps'],
    uploadMigrationData: ['FleetAdmin', 'WorkshopOps'],
    commitMigrationBatch: ['FleetAdmin'],
    
    // Aggregates and reports
    viewAggregates: ['FleetAdmin', 'WorkshopOps', 'StateOps', 'Viewer'],
  };

  const allowedRoles = permissions[permission];
  if (!allowedRoles) {
    console.warn(`Unknown permission: ${permission}`);
    return false;
  }

  return allowedRoles.includes(fleetRole);
}

export function requirePermission(user, permission) {
  if (!hasPermission(user, permission)) {
    throw new Error(`Insufficient permissions. Required: ${permission}. User role: ${user?.fleet_role || 'Viewer'}`);
  }
}