import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date().toISOString().split('T')[0];

    // Fetch all open/in-progress work orders with due dates
    const workOrders = await base44.asServiceRole.entities.MaintenanceWorkOrder.filter({});
    
    const overdueWOs = workOrders.filter(wo => 
      (wo.status === 'Open' || wo.status === 'InProgress') &&
      wo.due_date &&
      wo.due_date < today
    );

    if (overdueWOs.length === 0) {
      return Response.json({
        success: true,
        alerts_sent: 0,
        message: 'No overdue work orders found'
      });
    }

    // Fetch vehicles for the overdue WOs
    const vehicleIds = [...new Set(overdueWOs.map(wo => wo.vehicle_id))];
    const vehiclesPromises = vehicleIds.map(id => 
      base44.asServiceRole.entities.Vehicle.filter({ id }).then(v => v[0])
    );
    const vehicles = await Promise.all(vehiclesPromises);
    const vehicleMap = {};
    vehicles.forEach(v => { if (v) vehicleMap[v.id] = v; });

    // Group by state
    const byState = {};
    overdueWOs.forEach(wo => {
      const vehicle = vehicleMap[wo.vehicle_id];
      if (!vehicle) return;
      
      const state = vehicle.state;
      if (!byState[state]) byState[state] = [];
      byState[state].push({ wo, vehicle });
    });

    const alertsSent = [];

    // Send one email per state
    for (const [state, items] of Object.entries(byState)) {
      // Get state-specific email
      const stateKey = `StateOpsEmail_${state}`;
      const stateEmails = await base44.asServiceRole.entities.NotificationConfig.filter({ key: stateKey });
      let recipients = stateEmails.length > 0 ? stateEmails[0].value : '';

      if (!recipients) {
        const fleetEmails = await base44.asServiceRole.entities.NotificationConfig.filter({ key: 'FleetManagerEmail' });
        recipients = fleetEmails.length > 0 ? fleetEmails[0].value : '';
      }

      if (!recipients) continue;

      const subject = `[Fleet IQ] Overdue Work Orders – ${state} (${items.length})`;
      
      let woList = items.map(({ wo, vehicle }) => {
        const daysOverdue = Math.floor((new Date() - new Date(wo.due_date)) / (1000 * 60 * 60 * 24));
        return `• ${vehicle.asset_code} | WO Type: ${wo.work_order_type} | Priority: ${wo.priority} | Due: ${wo.due_date} (${daysOverdue} days overdue)`;
      }).join('\n');

      const body = `
Fleet IQ Overdue Work Orders Alert

State: ${state}
Total Overdue: ${items.length}

Work Orders:
${woList}

Please review and take action on these overdue maintenance work orders.

---
KPI Fleet IQ Automated Alert
      `.trim();

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipients,
          subject: subject,
          body: body
        });

        // Log the alert
        await base44.asServiceRole.entities.AlertLog.create({
          alert_type: 'WorkOrderOverdue',
          sent_at: new Date().toISOString(),
          recipients: recipients,
          subject: subject,
          related_entity_type: 'State',
          related_entity_id: state,
          status: 'Success'
        });

        alertsSent.push({ state, count: items.length });
      } catch (emailError) {
        await base44.asServiceRole.entities.AlertLog.create({
          alert_type: 'WorkOrderOverdue',
          sent_at: new Date().toISOString(),
          recipients: recipients,
          subject: subject,
          related_entity_type: 'State',
          related_entity_id: state,
          status: 'Failed',
          error_message: emailError.message
        });
      }
    }

    return Response.json({
      success: true,
      alerts_sent: alertsSent.length,
      details: alertsSent
    });

  } catch (error) {
    console.error('Auto alert work orders error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});