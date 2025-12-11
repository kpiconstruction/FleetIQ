import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get enriched maintenance plan schedule with computed fields
    const scheduleResponse = await base44.asServiceRole.functions.invoke('getMaintenancePlanSchedule', {
      stateFilter: 'all',
      functionClassFilter: 'all',
      ownershipFilter: 'all',
      providerFilter: 'all',
    });

    const scheduleData = scheduleResponse.data;
    if (!scheduleData.success) {
      throw new Error('Failed to fetch maintenance schedule');
    }

    const enrichedPlans = scheduleData.plans;

    // Track overdue plans
    const overduePlans = enrichedPlans.filter(p => p.is_overdue);
    const hvnlCriticalOverdue = overduePlans.filter(p => p.is_hvnl_critical);
    
    // Count by state
    const stateOverdueCount = {};
    overduePlans.forEach(plan => {
      const state = plan.vehicle.state;
      stateOverdueCount[state] = (stateOverdueCount[state] || 0) + 1;
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
              ${item.next_due_date ? `<br>Due: ${new Date(item.next_due_date).toLocaleDateString('en-AU')}` : ''}
              ${item.days_overdue ? `<br>Days Overdue: ${item.days_overdue}` : ''}
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