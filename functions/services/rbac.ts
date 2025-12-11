/**
 * RBAC (Role-Based Access Control) Helper
 * SINGLE SOURCE OF TRUTH for permissions across backend and frontend
 */

/**
 * Check if user has a specific permission based on their fleet_role
 * @param {Object} user - User object from base44.auth.me()
 * @param {string} permission - Permission key to check
 * @returns {boolean}
 */
export function hasPermission(user, permission) {
  if (!user || !user.fleet_role) return false;
  
  const fleetRole = user.fleet_role;
  const permissions = getPermissionsForRole(fleetRole);
  
  return permissions[permission] === true;
}

/**
 * Get all permissions for a role
 * @param {string} fleetRole - FleetAdmin | WorkshopOps | StateOps | FleetCoordinator | Viewer
 * @returns {Object} Permission map
 */
export function getPermissionsForRole(fleetRole) {
  const permissions = {
    // Dashboard and view permissions
    viewMaintenanceDashboards: ["FleetAdmin", "WorkshopOps", "StateOps", "FleetCoordinator", "Viewer"].includes(fleetRole),
    
    // Template and plan management
    createMaintenanceTemplate: fleetRole === "FleetAdmin",
    editMaintenanceTemplate: fleetRole === "FleetAdmin",
    deleteMaintenanceTemplate: fleetRole === "FleetAdmin",
    createMaintenancePlan: fleetRole === "FleetAdmin",
    editMaintenancePlan: fleetRole === "FleetAdmin",
    deletMaintenancePlan: fleetRole === "FleetAdmin",
    
    // Work order management
    createWorkOrder: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    updateWorkOrder: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    completeWorkOrder: ["FleetAdmin", "WorkshopOps", "FleetCoordinator"].includes(fleetRole),
    deleteWorkOrder: fleetRole === "FleetAdmin",
    
    // Service record management
    createServiceRecord: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    editServiceRecord: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    deleteServiceRecord: fleetRole === "FleetAdmin",
    
    // Migration
    accessMigration: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    uploadMigrationData: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    validateMigrationData: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    commitMigrationBatch: fleetRole === "FleetAdmin",
    
    // Vehicle management
    editVehicle: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    createVehicle: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    deleteVehicle: fleetRole === "FleetAdmin",
    
    // Configuration and settings
    editNotificationSettings: fleetRole === "FleetAdmin",
    editAutomationSettings: fleetRole === "FleetAdmin",
    
    // Worker risk and incidents
    editWorkerRiskStatus: fleetRole === "FleetAdmin",
    createIncidentRecord: ["FleetAdmin", "WorkshopOps", "StateOps"].includes(fleetRole),
    editIncidentRecord: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    
    // Hire provider management
    editHireProvider: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    editHireContract: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    
    // Prestart and defect management
    viewPrestarts: ["FleetAdmin", "WorkshopOps", "StateOps", "FleetCoordinator", "Viewer"].includes(fleetRole),
    editPrestartDefect: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
  };
  
  return permissions;
}

/**
 * Require permission or throw 403 error
 * @param {Object} user - User object from base44.auth.me()
 * @param {string} permission - Permission key to check
 * @param {string} customMessage - Optional custom error message
 * @throws {Response} 403 Forbidden if permission denied
 */
export function requirePermission(user, permission, customMessage = null) {
  if (!hasPermission(user, permission)) {
    const message = customMessage || `Forbidden: You do not have permission to perform this action (${permission})`;
    const requiredRoles = getRequiredRolesForPermission(permission);
    
    throw new Response(JSON.stringify({
      error: message,
      requiredPermission: permission,
      requiredRoles: requiredRoles,
      yourRole: user?.fleet_role || 'None'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get required roles for a permission
 */
function getRequiredRolesForPermission(permission) {
  const roleChecks = {
    createMaintenanceTemplate: ["FleetAdmin"],
    editMaintenanceTemplate: ["FleetAdmin"],
    createMaintenancePlan: ["FleetAdmin"],
    editMaintenancePlan: ["FleetAdmin"],
    createWorkOrder: ["FleetAdmin", "WorkshopOps"],
    updateWorkOrder: ["FleetAdmin", "WorkshopOps"],
    completeWorkOrder: ["FleetAdmin", "WorkshopOps", "FleetCoordinator"],
    createServiceRecord: ["FleetAdmin", "WorkshopOps"],
    editServiceRecord: ["FleetAdmin", "WorkshopOps"],
    accessMigration: ["FleetAdmin", "WorkshopOps"],
    commitMigrationBatch: ["FleetAdmin"],
    editNotificationSettings: ["FleetAdmin"],
    editAutomationSettings: ["FleetAdmin"],
    editWorkerRiskStatus: ["FleetAdmin"],
    createIncidentRecord: ["FleetAdmin", "WorkshopOps", "StateOps"],
    editIncidentRecord: ["FleetAdmin", "WorkshopOps"],
  };
  
  return roleChecks[permission] || ["FleetAdmin"];
}