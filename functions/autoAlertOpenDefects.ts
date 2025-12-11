import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get threshold configurations
    const highThresholdConfigs = await base44.asServiceRole.entities.AutomationConfig.filter({ key: 'DEFECT_HIGH_ALERT_HOURS' });
    const criticalThresholdConfigs = await base44.asServiceRole.entities.AutomationConfig.filter({ key: 'DEFECT_CRITICAL_ALERT_HOURS' });
    
    const highThresholdHours = highThresholdConfigs.length > 0 ? parseInt(highThresholdConfigs[0].value) : 24;
    const criticalThresholdHours = criticalThresholdConfigs.length > 0 ? parseInt(criticalThresholdConfigs[0].value) : 4;

    const now = new Date();
    const highThreshold = new Date(now.getTime() - highThresholdHours * 60 * 60 * 1000);
    const criticalThreshold = new Date(now.getTime() - criticalThresholdHours * 60 * 60 * 1000);

    // Fetch all open defects
    const defects = await base44.asServiceRole.entities.PrestartDefect.filter({ status: 'Open' });
    
    const alertableDefects = defects.filter(d => {
      if (!d.reported_at) return false;
      const reportedAt = new Date(d.reported_at);
      
      if (d.severity === 'Critical') {
        return reportedAt <= criticalThreshold;
      } else if (d.severity === 'High') {
        return reportedAt <= highThreshold;
      }
      return false;
    });

    if (alertableDefects.length === 0) {
      return Response.json({
        success: true,
        alerts_sent: 0,
        message: 'No defects requiring escalation'
      });
    }

    // Get recipients
    const hseEmails = await base44.asServiceRole.entities.NotificationConfig.filter({ key: 'HSEManagerEmail' });
    const fleetEmails = await base44.asServiceRole.entities.NotificationConfig.filter({ key: 'FleetManagerEmail' });
    
    let recipients = '';
    if (hseEmails.length > 0) recipients += hseEmails[0].value;
    if (fleetEmails.length > 0) {
      if (recipients) recipients += ',';
      recipients += fleetEmails[0].value;
    }

    if (!recipients) {
      return Response.json({
        success: true,
        alerts_sent: 0,
        message: 'No recipients configured'
      });
    }

    // Fetch vehicles
    const vehicleIds = [...new Set(alertableDefects.map(d => d.vehicle_id).filter(Boolean))];
    const vehiclesPromises = vehicleIds.map(id => 
      base44.asServiceRole.entities.Vehicle.filter({ id }).then(v => v[0])
    );
    const vehicles = await Promise.all(vehiclesPromises);
    const vehicleMap = {};
    vehicles.forEach(v => { if (v) vehicleMap[v.id] = v; });

    const alertsSent = [];

    for (const defect of alertableDefects) {
      const vehicle = vehicleMap[defect.vehicle_id];
      if (!vehicle) continue;

      const reportedAt = new Date(defect.reported_at);
      const hoursOpen = Math.floor((now - reportedAt) / (1000 * 60 * 60));

      const subject = `[Fleet IQ] ${defect.severity} Defect OPEN for ${hoursOpen}h – ${vehicle.asset_code}`;
      
      const body = `
Fleet IQ Defect Escalation Alert

Severity: ${defect.severity}
Vehicle: ${vehicle.asset_code} (${vehicle.rego})
State: ${vehicle.state}

Defect Description: ${defect.defect_description}

Reported: ${defect.reported_at}
Hours Open: ${hoursOpen}

Please urgently review and address this ${defect.severity.toLowerCase()} defect.

---
KPI Fleet IQ Automated Alert
      `.trim();

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipients,
          subject: subject,
          body: body
        });

        await base44.asServiceRole.entities.AlertLog.create({
          alert_type: 'DefectEscalation',
          sent_at: new Date().toISOString(),
          recipients: recipients,
          subject: subject,
          related_entity_type: 'PrestartDefect',
          related_entity_id: defect.id,
          status: 'Success'
        });

        alertsSent.push({ defect_id: defect.id, vehicle: vehicle.asset_code, severity: defect.severity });
      } catch (emailError) {
        await base44.asServiceRole.entities.AlertLog.create({
          alert_type: 'DefectEscalation',
          sent_at: new Date().toISOString(),
          recipients: recipients,
          subject: subject,
          related_entity_type: 'PrestartDefect',
          related_entity_id: defect.id,
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
    console.error('Auto alert open defects error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});