import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { work_order_id, status, purchase_order_number, confirmed_downtime_hours, completion_notes, cost_chargeable_to } = await req.json();

    // Only validate when changing to Completed
    if (status !== 'Completed') {
      return Response.json({ valid: true });
    }

    // Fetch the work order and vehicle
    const workOrders = await base44.asServiceRole.entities.MaintenanceWorkOrder.filter({ id: work_order_id });
    if (!workOrders || workOrders.length === 0) {
      return Response.json({ error: 'Work order not found' }, { status: 404 });
    }
    const workOrder = workOrders[0];

    const vehicles = await base44.asServiceRole.entities.Vehicle.filter({ id: workOrder.vehicle_id });
    if (!vehicles || vehicles.length === 0) {
      return Response.json({ error: 'Vehicle not found' }, { status: 404 });
    }
    const vehicle = vehicles[0];

    const ownershipType = vehicle.ownership_type;

    // Rule 1: Owned Fleet - PO Number Required
    if (ownershipType === 'Owned') {
      if (!purchase_order_number || purchase_order_number.trim() === '') {
        return Response.json({
          valid: false,
          error: 'Purchase Order number is required to complete work orders for owned assets.',
          rule: 'owned_po_required'
        }, { status: 400 });
      }
      // Valid for owned fleet
      return Response.json({ 
        valid: true, 
        ownership_type: ownershipType,
        cost_chargeable_to: cost_chargeable_to || 'KPI'
      });
    }

    // Rule 2: Hire Fleet - Confirmation + Downtime Required
    if (ownershipType === 'ContractHire' || ownershipType === 'DayHire') {
      // Check user role
      const userRole = user.fleet_role;
      const allowedRoles = ['FleetAdmin', 'FleetCoordinator'];
      
      if (!allowedRoles.includes(userRole)) {
        return Response.json({
          valid: false,
          error: 'Only Fleet Coordinators can confirm completion for hire fleet work orders.',
          rule: 'hire_coordinator_required'
        }, { status: 403 });
      }

      // Check downtime hours
      if (!confirmed_downtime_hours || confirmed_downtime_hours <= 0) {
        return Response.json({
          valid: false,
          error: 'Hire fleet work orders must record confirmed downtime and be confirmed by a Fleet Coordinator.',
          rule: 'hire_downtime_required'
        }, { status: 400 });
      }

      // Valid for hire fleet
      // Validate cost_chargeable_to for hire fleet
      const finalCostChargeableTo = cost_chargeable_to || (workOrder.work_order_type === 'Scheduled' ? 'HireProvider' : 'KPI');
      
      return Response.json({ 
        valid: true, 
        ownership_type: ownershipType,
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
        cost_chargeable_to: finalCostChargeableTo
      });
    }

    // Unknown ownership type - allow but warn
    return Response.json({ 
      valid: true, 
      ownership_type: ownershipType,
      warning: 'Unknown ownership type - no validation applied'
    });

  } catch (error) {
    console.error('Work order completion validation error:', error);
    return Response.json({ 
      valid: false,
      error: error.message 
    }, { status: 500 });
  }
});