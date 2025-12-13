import { hasPermission } from './checkPermissions.js';
import { getUserFromRequest } from './services/auth.ts';
import { listVehicles } from './services/repositories.ts';

/**
 * Export Vehicles for Trae Migration
 * Read-only API with paging and filtering
 * 
 * READY FOR TRAE BACKEND – v1 export contract. Do not change field names without versioning.
 */
Deno.serve(async (req) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only FleetAdmin can export
    if (!hasPermission(user, 'createMaintenanceTemplate')) {
      return Response.json({ 
        error: 'Forbidden: Only FleetAdmin can export data',
        yourRole: user.fleet_role || 'None'
      }, { status: 403 });
    }

    const body = await req.json();
    const { 
      offset = 0, 
      limit = 100,
      stateFilter = null,
      ownershipFilter = null,
    } = body;
    const { total, rows } = await listVehicles(stateFilter, ownershipFilter, offset, limit);
    const normalizedVehicles = rows.map(v => ({
      id: v.id,
      asset_code: v.asset_code,
      rego: v.rego,
      vin: v.vin,
      
      // Classification
      asset_type: v.asset_type,
      vehicle_function_class: v.vehicle_function_class,
      tma_variant: v.tma_variant,
      
      // Vehicle details
      make: v.make,
      model: v.model,
      year: v.year,
      
      // Location
      state: v.state,
      primary_depot: v.primary_depot,
      
      // Status
      status: v.status,
      in_service_date: v.in_service_date,
      out_of_service_date: v.out_of_service_date,
      
      // Ownership
      ownership_type: v.ownership_type,
      hire_provider_id: v.hire_provider_id,
      contract_id: v.contract_id,
      
      // Odometer
      current_odometer_km: v.current_odometer_km,
      odometer_data_confidence: v.odometer_data_confidence,
      
      // Assignar integration
      assignar_tracked: v.assignar_tracked,
      assignar_asset_id: v.assignar_asset_id,
      
      // Metadata
      created_date: v.created_date,
      updated_date: v.updated_date,
    }));

    return Response.json({
      success: true,
      data: normalizedVehicles,
      pagination: {
        offset,
        limit,
        returned: normalizedVehicles.length,
        total,
        hasMore: (offset + limit) < total,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('exportVehiclesForTrae error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});
