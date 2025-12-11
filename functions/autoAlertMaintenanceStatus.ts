import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch maintenance plan schedule
    const scheduleResponse = await base44.asServiceRole.functions.invoke('getMaintenancePlanSchedule', {
      stateFilter: 'all',
      functionClassFilter: 'all',
      ownershipFilter: 'all',
      providerFilter: 'all',
      statusFilter: 'all'
    });

    const plans = scheduleResponse.data.plans || [];
    const alertsSent = [];

    for (const plan of plans) {
      // Determine if we should alert based on status change
      let shouldAlert = false;
      let alertType = '';

      if (plan.status === 'DueSoon' && plan.days_until_due <= 7) {
        shouldAlert = true;
        alertType = 'DueSoon';
      } else if (plan.status === 'Overdue') {
        shouldAlert = true;
        alertType = 'Overdue';
      }

      if (!shouldAlert) continue;

      // Get state-specific email
      const stateKey = `StateOpsEmail_${plan.vehicle.state}`;
      const stateEmails = await base44.asServiceRole.entities.NotificationConfig.filter({ key: stateKey });
      let recipients = stateEmails.length > 0 ? stateEmails[0].value : '';

      // Fallback to fleet manager email
      if (!recipients) {
        const fleetEmails = await base44.asServiceRole.entities.NotificationConfig.filter({ key: 'FleetManagerEmail' });
        recipients = fleetEmails.length > 0 ? fleetEmails[0].value : '';
      }

      if (!recipients) continue;

      const subject = alertType === 'DueSoon' 
        ? `[Fleet IQ] Plan now DUE SOON – ${plan.vehicle.asset_code} / ${plan.vehicle.state}`
        : `[Fleet IQ] Plan now OVERDUE – ${plan.vehicle.asset_code} / ${plan.vehicle.state}`;

      const body = `
Fleet IQ Maintenance Alert

Vehicle: ${plan.vehicle.asset_code} (${plan.vehicle.rego})
State: ${plan.vehicle.state}
Function Class: ${plan.vehicle.vehicle_function_class}

Plan: ${plan.template?.name || 'N/A'}
Status: ${plan.status}
Next Due Date: ${plan.next_due_date || 'N/A'}
Next Due Odometer: ${plan.next_due_odometer_km ? plan.next_due_odometer_km + ' km' : 'N/A'}
${alertType === 'Overdue' ? `Days Overdue: ${plan.days_overdue || 0}` : `Days Until Due: ${plan.days_until_due || 0}`}

Please take appropriate action.

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
          alert_type: 'MaintenancePlanStatus',
          sent_at: new Date().toISOString(),
          recipients: recipients,
          subject: subject,
          related_entity_type: 'MaintenancePlan',
          related_entity_id: plan.id,
          status: 'Success'
        });

        alertsSent.push({ plan_id: plan.id, vehicle: plan.vehicle.asset_code, type: alertType });
      } catch (emailError) {
        // Log failed alert
        await base44.asServiceRole.entities.AlertLog.create({
          alert_type: 'MaintenancePlanStatus',
          sent_at: new Date().toISOString(),
          recipients: recipients,
          subject: subject,
          related_entity_type: 'MaintenancePlan',
          related_entity_id: plan.id,
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
    console.error('Auto alert maintenance status error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});