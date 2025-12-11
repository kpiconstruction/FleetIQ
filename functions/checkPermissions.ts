/**
 * RBAC permission checker for Fleet IQ backend functions
 * SINGLE SOURCE OF TRUTH for backend permissions
 */

export function hasPermission(user, permission) {
  const fleetRole = user?.fleet_role || 'Viewer';

  const permissions = {
    // Dashboard and view permissions
    viewMaintenanceDashboards: ['FleetAdmin', 'WorkshopOps', 'StateOps', 'FleetCoordinator', 'Viewer'],
    
    // Template and plan management
    createMaintenanceTemplate: ['FleetAdmin'],
    editMaintenanceTemplate: ['FleetAdmin'],
    deleteMaintenanceTemplate: ['FleetAdmin'],
    createMaintenancePlan: ['FleetAdmin'],
    editMaintenancePlan: ['FleetAdmin'],
    deletMaintenancePlan: ['FleetAdmin'],
    
    // Work order management
    createWorkOrder: ['FleetAdmin', 'WorkshopOps'],
    updateWorkOrder: ['FleetAdmin', 'WorkshopOps'],
    completeWorkOrder: ['FleetAdmin', 'WorkshopOps', 'FleetCoordinator'],
    deleteWorkOrder: ['FleetAdmin'],
    
    // Service record management
    createServiceRecord: ['FleetAdmin', 'WorkshopOps'],
    editServiceRecord: ['FleetAdmin', 'WorkshopOps'],
    deleteServiceRecord: ['FleetAdmin'],
    
    // Migration
    accessMigration: ['FleetAdmin', 'WorkshopOps'],
    uploadMigrationData: ['FleetAdmin', 'WorkshopOps'],
    validateMigrationData: ['FleetAdmin', 'WorkshopOps'],
    commitMigrationBatch: ['FleetAdmin'],
    
    // Vehicle management
    editVehicle: ['FleetAdmin', 'WorkshopOps'],
    createVehicle: ['FleetAdmin', 'WorkshopOps'],
    deleteVehicle: ['FleetAdmin'],
    
    // Configuration and settings
    editNotificationSettings: ['FleetAdmin'],
    editAutomationSettings: ['FleetAdmin'],
    
    // Worker risk and incidents
    editWorkerRiskStatus: ['FleetAdmin'],
    createIncidentRecord: ['FleetAdmin', 'WorkshopOps', 'StateOps'],
    editIncidentRecord: ['FleetAdmin', 'WorkshopOps'],
    
    // Hire provider management
    editHireProvider: ['FleetAdmin', 'WorkshopOps'],
    editHireContract: ['FleetAdmin', 'WorkshopOps'],
    
    // Prestart and defect management
    viewPrestarts: ['FleetAdmin', 'WorkshopOps', 'StateOps', 'FleetCoordinator', 'Viewer'],
    editPrestartDefect: ['FleetAdmin', 'WorkshopOps'],
    
    // Aggregates and reports
    viewAggregates: ['FleetAdmin', 'WorkshopOps', 'StateOps', 'FleetCoordinator', 'Viewer'],
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
    const message = `Insufficient permissions. Required: ${permission}. User role: ${user?.fleet_role || 'Viewer'}`;
    throw new Error(message);
  }
}

/**
 * Return 403 response if permission denied
 */
export function checkPermissionOrForbid(user, permission) {
  if (!hasPermission(user, permission)) {
    return Response.json({
      error: `Forbidden: You do not have permission to perform this action`,
      requiredPermission: permission,
      yourRole: user?.fleet_role || 'None'
    }, { status: 403 });
  }
  return null; // Permission granted
}