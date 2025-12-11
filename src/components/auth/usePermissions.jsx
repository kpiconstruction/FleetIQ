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
    viewMaintenanceDashboards: ["FleetAdmin", "WorkshopOps", "StateOps", "Viewer"].includes(fleetRole),
    
    // Template and plan management
    createMaintenanceTemplate: fleetRole === "FleetAdmin",
    editMaintenanceTemplate: fleetRole === "FleetAdmin",
    createMaintenancePlan: fleetRole === "FleetAdmin",
    editMaintenancePlan: fleetRole === "FleetAdmin",
    
    // Work order management
    createWorkOrder: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    updateWorkOrder: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    
    // Service history migration
    accessMigration: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    uploadMigrationData: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    commitMigrationBatch: fleetRole === "FleetAdmin",
    
    // Vehicle management
    editVehicle: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
    createServiceRecord: ["FleetAdmin", "WorkshopOps"].includes(fleetRole),
  };

  return {
    user,
    fleetRole,
    can,
    isFleetAdmin: fleetRole === "FleetAdmin",
    isWorkshopOps: fleetRole === "WorkshopOps",
    isStateOps: fleetRole === "StateOps",
    isViewer: fleetRole === "Viewer",
  };
}