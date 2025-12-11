import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();

    // Fetch all active maintenance plans
    const maintenancePlans = await base44.asServiceRole.entities.MaintenancePlan.filter({ status: 'Active' });
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const templates = await base44.asServiceRole.entities.MaintenanceTemplate.filter({ active: true });

    // Create lookup maps
    const vehicleMap = {};
    vehicles.forEach(v => vehicleMap[v.id] = v);

    const templateMap = {};
    templates.forEach(t => templateMap[t.id] = t);

    // Track overdue plans
    const overduePlans = [];
    const hvnlCriticalOverdue = [];
    const stateOverdueCount = {};

    maintenancePlans.forEach(plan => {
      const vehicle = vehicleMap[plan.vehicle_id];
      const template = templateMap[plan.maintenance_template_id];

      if (!vehicle || !template) return;

      const state = vehicle.state;
      if (!stateOverdueCount[state]) {
        stateOverdueCount[state] = 0;
      }

      let isOverdue = false;

      // Check date-based overdue
      if (plan.next_due_date) {
        const dueDate = new Date(plan.next_due_date);
        if (dueDate < now) {
          isOverdue = true;
        }
      }

      // Check odometer-based overdue
      if (plan.next_due_odometer_km && vehicle.current_odometer_km) {
        if (vehicle.current_odometer_km >= plan.next_due_odometer_km) {
          isOverdue = true;
        }
      }

      if (isOverdue) {
        overduePlans.push({
          plan,
          vehicle,
          template,
        });

        stateOverdueCount[state]++;

        // Track HVNL-critical overdue
        if (template.hvnl_relevance_flag) {
          hvnlCriticalOverdue.push({
            plan,
            vehicle,
            template,
          });
        }
      }
    });

    // Send notifications for HVNL-critical overdue plans
    if (hvnlCriticalOverdue.length > 0) {
      const recipients = [
        'fleet.manager@kpi.com.au',
        'hse.manager@kpi.com.au',
      ];

      const emailBody = `
        <h2>⚠️ HVNL-Critical Maintenance Overdue Alert</h2>
        <p><strong>${hvnlCriticalOverdue.length} HVNL-critical maintenance plans are overdue</strong> and require immediate attention.</p>
        <h3>Overdue Plans:</h3>
        <ul>
          ${hvnlCriticalOverdue.map(item => `
            <li>
              <strong>${item.vehicle.asset_code}</strong> (${item.vehicle.state}) - ${item.template.name}
              ${item.plan.next_due_date ? `<br>Due: ${new Date(item.plan.next_due_date).toLocaleDateString('en-AU')}` : ''}
            </li>
          `).join('')}
        </ul>
        <p>Please log in to Fleet IQ to schedule maintenance immediately.</p>
      `;

      for (const recipient of recipients) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            from_name: 'KPI Fleet IQ - Maintenance Alerts',
            to: recipient,
            subject: `🚨 HVNL-Critical Maintenance Overdue (${hvnlCriticalOverdue.length} vehicles)`,
            body: emailBody,
          });
        } catch (error) {
          console.error(`Failed to send email to ${recipient}:`, error);
        }
      }
    }

    // Check state-level thresholds (configurable - set to 5 for now)
    const STATE_THRESHOLD = 5;
    const stateAlertsTriggered = [];

    Object.entries(stateOverdueCount).forEach(([state, count]) => {
      if (count >= STATE_THRESHOLD) {
        stateAlertsTriggered.push({ state, count });

        // Send notification to State Operations Manager
        const stateEmail = `state.ops.${state.toLowerCase()}@kpi.com.au`;
        
        const emailBody = `
          <h2>⚠️ State Maintenance Alert: ${state}</h2>
          <p><strong>${count} overdue maintenance plans</strong> in ${state} have exceeded the threshold (${STATE_THRESHOLD}).</p>
          <p>Immediate review and action required to maintain fleet compliance and availability.</p>
          <p>Please log in to Fleet IQ Maintenance Planner to review and schedule these services.</p>
        `;

        base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'KPI Fleet IQ - State Alerts',
          to: stateEmail,
          subject: `🚨 ${state} Maintenance Alert - ${count} Overdue Plans`,
          body: emailBody,
        }).catch(err => console.error(`Failed to send state alert to ${stateEmail}:`, err));
      }
    });

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_overdue: overduePlans.length,
        hvnl_critical_overdue: hvnlCriticalOverdue.length,
        state_alerts_triggered: stateAlertsTriggered,
      },
      notifications_sent: hvnlCriticalOverdue.length > 0 ? 2 : 0,
    });

  } catch (error) {
    console.error('Maintenance notification error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});