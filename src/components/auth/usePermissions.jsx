import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function usePermissions() {
  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const fleetRole = user?.fleet_role || "Viewer";

  const can = {
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

  return {
    user,
    fleetRole,
    can,
    isFleetAdmin: fleetRole === "FleetAdmin",
    isWorkshopOps: fleetRole === "WorkshopOps",
    isStateOps: fleetRole === "StateOps",
    isFleetCoordinator: fleetRole === "FleetCoordinator",
    isViewer: fleetRole === "Viewer",
  };
}