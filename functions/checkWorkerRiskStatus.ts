import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Use service role for system-level operations
    const now = new Date().toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all data
    const prestarts = await base44.asServiceRole.entities.PrestartCheck.list('-prestart_datetime', 2000);
    const incidents = await base44.asServiceRole.entities.IncidentRecord.list('-incident_datetime', 1000);
    const defects = await base44.asServiceRole.entities.PrestartDefect.list('-reported_at', 1000);
    const existingStatuses = await base44.asServiceRole.entities.WorkerRiskStatus.list();

    // Calculate risk for all workers
    const workerData = {};

    // Process prestarts
    prestarts.forEach((p) => {
      const workerName = p.worker_name || p.operator_name;
      if (!workerName) return;

      if (!workerData[workerName]) {
        workerData[workerName] = {
          worker_name: workerName,
          worker_external_id: p.worker_external_id,
          failed_prestarts_90d: 0,
          critical_defects_90d: 0,
          incidents_12m: 0,
          hvnl_incidents_12m: 0,
          at_fault_count: 0,
        };
      }

      if (p.prestart_datetime >= ninetyDaysAgo && p.overall_result === 'Fail') {
        workerData[workerName].failed_prestarts_90d++;
      }
    });

    // Process defects
    defects.forEach((d) => {
      const prestart = prestarts.find(p => p.id === d.prestart_id);
      if (!prestart) return;

      const workerName = prestart.worker_name || prestart.operator_name;
      if (!workerName || !workerData[workerName]) return;

      const defectDate = d.reported_at || prestart.prestart_datetime;
      if (defectDate >= ninetyDaysAgo && d.severity === 'Critical') {
        workerData[workerName].critical_defects_90d++;
      }
    });

    // Process incidents
    incidents.forEach((inc) => {
      const workerName = inc.driver_name;
      if (!workerName) return;

      if (!workerData[workerName]) {
        workerData[workerName] = {
          worker_name: workerName,
          worker_external_id: inc.driver_external_id,
          failed_prestarts_90d: 0,
          critical_defects_90d: 0,
          incidents_12m: 0,
          hvnl_incidents_12m: 0,
          at_fault_count: 0,
        };
      }

      if (inc.incident_datetime >= twelveMonthsAgo) {
        workerData[workerName].incidents_12m++;
        workerData[workerName].at_fault_count++;

        if (inc.incident_type === 'HVNL Breach' && 
            (inc.severity === 'Critical' || inc.severity === 'Serious')) {
          workerData[workerName].hvnl_incidents_12m++;
        }
      }
    });

    // Calculate risk levels and process alerts
    const statusMap = {};
    existingStatuses.forEach(s => statusMap[s.worker_name] = s);

    const newAlerts = [];
    const escalations = [];
    const updates = [];

    for (const worker of Object.values(workerData)) {
      // Calculate risk level
      let riskScore = 0;
      if (worker.failed_prestarts_90d >= 5) riskScore += 2;
      else if (worker.failed_prestarts_90d >= 3) riskScore += 1;

      if (worker.critical_defects_90d >= 3) riskScore += 2;
      else if (worker.critical_defects_90d >= 2) riskScore += 1;

      if (worker.at_fault_count >= 2) riskScore += 3;
      else if (worker.at_fault_count >= 1) riskScore += 1;

      if (worker.hvnl_incidents_12m >= 1) riskScore += 3;

      let currentRiskLevel = 'Green';
      if (riskScore >= 5) currentRiskLevel = 'Red';
      else if (riskScore >= 3) currentRiskLevel = 'Amber';

      const existingStatus = statusMap[worker.worker_name];

      if (!existingStatus) {
        // New worker - create status record
        const newStatus = {
          worker_name: worker.worker_name,
          worker_external_id: worker.worker_external_id,
          current_risk_level: currentRiskLevel,
          previous_risk_level: 'Green',
          first_detected_datetime: now,
          last_updated_datetime: now,
          risk_score: riskScore,
          alert_sent: currentRiskLevel === 'Red',
          escalation_sent: false,
          ...worker,
        };

        await base44.asServiceRole.entities.WorkerRiskStatus.create(newStatus);

        if (currentRiskLevel === 'Red') {
          newAlerts.push(newStatus);
        }
      } else {
        // Existing worker - check for changes
        const statusChanged = existingStatus.current_risk_level !== currentRiskLevel;
        const nowRed = currentRiskLevel === 'Red';
        const wasNotRed = existingStatus.current_risk_level !== 'Red';

        let updateData = {
          current_risk_level: currentRiskLevel,
          last_updated_datetime: now,
          risk_score: riskScore,
          ...worker,
        };

        // Update first_detected_datetime if risk level changed
        if (statusChanged) {
          updateData.previous_risk_level = existingStatus.current_risk_level;
          updateData.first_detected_datetime = now;
          updateData.alert_sent = false;
          updateData.escalation_sent = false;
        }

        // Check for new Red alert
        if (nowRed && wasNotRed && !existingStatus.alert_sent) {
          newAlerts.push({ ...worker, ...updateData });
          updateData.alert_sent = true;
        }

        // Check for 30-day escalation
        if (currentRiskLevel === 'Red' && !existingStatus.escalation_sent) {
          const firstDetected = new Date(existingStatus.first_detected_datetime);
          const daysSinceRed = (Date.now() - firstDetected.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceRed >= 30) {
            escalations.push({ ...worker, ...updateData, days_at_red: Math.floor(daysSinceRed) });
            updateData.escalation_sent = true;
          }
        }

        await base44.asServiceRole.entities.WorkerRiskStatus.update(existingStatus.id, updateData);
        updates.push({ worker_name: worker.worker_name, status: currentRiskLevel });
      }
    }

    // Send alerts for new Red workers
    for (const alert of newAlerts) {
      const emailBody = `
HIGH-RISK WORKER ALERT - Immediate Action Required

Worker: ${alert.worker_name}
Risk Level: RED
Risk Score: ${alert.risk_score}
Date Flagged: ${new Date(now).toLocaleDateString()}

REASON FOR HIGH-RISK CLASSIFICATION:
- Failed Prestarts (90 days): ${alert.failed_prestarts_90d}
- Critical Defects (90 days): ${alert.critical_defects_90d}
- Total Incidents (12 months): ${alert.incidents_12m}
- HVNL Breaches (12 months): ${alert.hvnl_incidents_12m}
- At-Fault Incidents: ${alert.at_fault_count}

IMMEDIATE ACTIONS REQUIRED:
1. Review worker risk profile in Fleet IQ
2. Conduct safety interview within 24 hours
3. Implement supervision period
4. Document corrective actions

View full details: ${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/WorkerRiskProfile?worker=${encodeURIComponent(alert.worker_name)}

This is an automated alert from KPI Fleet IQ.
      `.trim();

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'KPI Fleet IQ - Safety Alerts',
          to: 'fleet.manager@kpi.com.au',
          subject: `🚨 HIGH-RISK WORKER ALERT: ${alert.worker_name}`,
          body: emailBody,
        });
      } catch (emailError) {
        console.error('Failed to send alert email:', emailError);
      }
    }

    // Send escalation alerts for workers Red for 30+ days
    for (const escalation of escalations) {
      const emailBody = `
HIGH-RISK WORKER ESCALATION - 30+ Days at Red Risk Level

Worker: ${escalation.worker_name}
Risk Level: RED (for ${escalation.days_at_red} days)
Risk Score: ${escalation.risk_score}

This worker has remained at RED risk level for over 30 days.

CURRENT STATUS:
- Failed Prestarts (90 days): ${escalation.failed_prestarts_90d}
- Critical Defects (90 days): ${escalation.critical_defects_90d}
- Total Incidents (12 months): ${escalation.incidents_12m}
- HVNL Breaches (12 months): ${escalation.hvnl_incidents_12m}

ESCALATED ACTIONS REQUIRED:
1. Executive review of worker status
2. Consider suspension from operations
3. Formal disciplinary process
4. Mandatory retraining program
5. National Compliance Lead review

View full details: ${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/WorkerRiskProfile?worker=${encodeURIComponent(escalation.worker_name)}

This is an automated escalation from KPI Fleet IQ.
      `.trim();

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'KPI Fleet IQ - Safety Escalation',
          to: 'national.compliance@kpi.com.au',
          subject: `⚠️ ESCALATION: ${escalation.worker_name} - Red Risk for ${escalation.days_at_red} days`,
          body: emailBody,
        });
      } catch (emailError) {
        console.error('Failed to send escalation email:', emailError);
      }
    }

    return Response.json({
      success: true,
      timestamp: now,
      workers_evaluated: Object.keys(workerData).length,
      new_red_alerts: newAlerts.length,
      escalations_sent: escalations.length,
      statuses_updated: updates.length,
      new_alerts: newAlerts.map(a => a.worker_name),
      escalations: escalations.map(e => e.worker_name),
    });

  } catch (error) {
    console.error('Risk check error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});