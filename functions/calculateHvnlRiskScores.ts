import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { getNotificationEmail } from './getNotificationEmail.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Fetch all required data using service role
    const [vehicles, maintenancePlans, maintenanceTemplates, workOrders, prestartDefects, incidents] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.MaintenancePlan.list(),
      base44.asServiceRole.entities.MaintenanceTemplate.list(),
      base44.asServiceRole.entities.MaintenanceWorkOrder.list('-raised_datetime', 1000),
      base44.asServiceRole.entities.PrestartDefect.filter({ status: 'Open' }),
      base44.asServiceRole.entities.IncidentRecord.list('-incident_datetime', 500),
    ]);

    // Create lookup maps
    const templateMap = {};
    maintenanceTemplates.forEach(t => templateMap[t.id] = t);

    // Filter to HVNL-relevant vehicles only
    const hvnlVehicles = vehicles.filter(v => v.status === 'Active');

    const riskScores = [];

    hvnlVehicles.forEach(vehicle => {
      // Check if vehicle has any HVNL-relevant maintenance plans
      const vehicleHvnlPlans = maintenancePlans.filter(plan => {
        if (plan.vehicle_id !== vehicle.id) return false;
        if (plan.status !== 'Active') return false;
        const template = templateMap[plan.maintenance_template_id];
        return template?.hvnl_relevance_flag === true;
      });

      // If no HVNL plans, skip this vehicle
      if (vehicleHvnlPlans.length === 0) return;

      let riskScore = 0;

      // 1. Overdue HVNL-critical MaintenancePlans
      const overduePlans = vehicleHvnlPlans.filter(plan => {
        if (plan.next_due_date) {
          const dueDate = new Date(plan.next_due_date);
          if (dueDate < now) return true;
        }
        if (plan.next_due_odometer_km && vehicle.current_odometer_km) {
          if (vehicle.current_odometer_km >= plan.next_due_odometer_km) return true;
        }
        return false;
      });

      const overdueCount = overduePlans.length;
      if (overdueCount > 0) {
        riskScore += 30; // First overdue plan
        riskScore += Math.min((overdueCount - 1) * 10, 30); // Additional plans, capped at +30
      }

      // Calculate max days overdue
      let maxDaysOverdue = 0;
      overduePlans.forEach(plan => {
        if (plan.next_due_date) {
          const dueDate = new Date(plan.next_due_date);
          const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
          if (daysOverdue > maxDaysOverdue) maxDaysOverdue = daysOverdue;
        }
      });

      // 2. Open SafetyCritical PrestartDefects
      const openCriticalDefects = prestartDefects.filter(d => 
        d.vehicle_id === vehicle.id && 
        (d.severity === 'Critical' || d.severity === 'High')
      );
      const openCriticalDefectCount = openCriticalDefects.length;
      riskScore += openCriticalDefectCount * 10; // +10 per open critical defect

      // 3. Safety-critical defects in last 90 days
      const recentDefects = prestartDefects.filter(d => {
        if (d.vehicle_id !== vehicle.id) return false;
        if (d.severity !== 'Critical' && d.severity !== 'High') return false;
        const reportedAt = d.reported_at ? new Date(d.reported_at) : null;
        return reportedAt && reportedAt >= ninetyDaysAgo;
      });
      riskScore += Math.min(recentDefects.length * 5, 25); // +5 each, capped at +25

      // 4. Corrective/Defect WOs in last 90 days
      const recentCorrectiveWOs = workOrders.filter(wo => {
        if (wo.vehicle_id !== vehicle.id) return false;
        if (wo.work_order_type !== 'Corrective' && wo.work_order_type !== 'DefectRepair') return false;
        const raisedDate = new Date(wo.raised_datetime);
        return raisedDate >= ninetyDaysAgo;
      });
      riskScore += Math.min(recentCorrectiveWOs.length * 3, 15); // +3 each, capped at +15

      // 5. Maintenance-related incidents in last 12 months
      const maintenanceIncidents = incidents.filter(i => {
        if (i.vehicle_id !== vehicle.id) return false;
        const incidentDate = new Date(i.incident_datetime);
        if (incidentDate < twelveMonthsAgo) return false;
        // Consider incidents related to maintenance: equipment failure, defects, etc.
        return i.incident_type === 'Accident' || 
               i.incident_type === 'Property Damage' || 
               i.incident_type === 'HVNL Breach';
      });
      riskScore += Math.min(maintenanceIncidents.length * 15, 30); // +15 each, capped at +30

      // Clamp to 0-100
      riskScore = Math.min(Math.max(riskScore, 0), 100);

      // Determine risk level
      let riskLevel = 'Low';
      if (riskScore > 60) riskLevel = 'High';
      else if (riskScore > 30) riskLevel = 'Medium';

      riskScores.push({
        vehicle_id: vehicle.id,
        asset_code: vehicle.asset_code,
        rego: vehicle.rego,
        state: vehicle.state,
        vehicle_function_class: vehicle.vehicle_function_class,
        risk_score: riskScore,
        risk_level: riskLevel,
        hvnl_overdue_count: overdueCount,
        max_days_overdue: maxDaysOverdue,
        open_critical_defects: openCriticalDefectCount,
        recent_defects_90d: recentDefects.length,
        recent_corrective_wos_90d: recentCorrectiveWOs.length,
        maintenance_incidents_12m: maintenanceIncidents.length,
      });
    });

    // Sort by risk score descending
    riskScores.sort((a, b) => b.risk_score - a.risk_score);

    // Identify high-risk assets for notifications
    const highRiskAssets = riskScores.filter(r => r.risk_level === 'High');

    // Send notification if there are high-risk assets (optional - can be called separately)
    if (highRiskAssets.length > 0) {
      const emailBody = `
        <h2>⚠️ HVNL High-Risk Assets Alert</h2>
        <p><strong>${highRiskAssets.length} HVNL-critical assets</strong> have been identified as high-risk (score > 60).</p>
        <h3>Top 10 High-Risk Assets:</h3>
        <table border="1" cellpadding="8" style="border-collapse: collapse;">
          <tr style="background-color: #f3f4f6;">
            <th>Asset Code</th>
            <th>State</th>
            <th>Risk Score</th>
            <th>Overdue Plans</th>
            <th>Open Defects</th>
          </tr>
          ${highRiskAssets.slice(0, 10).map(asset => `
            <tr>
              <td>${asset.asset_code}</td>
              <td>${asset.state}</td>
              <td style="color: #dc2626; font-weight: bold;">${asset.risk_score}</td>
              <td>${asset.hvnl_overdue_count}</td>
              <td>${asset.open_critical_defects}</td>
            </tr>
          `).join('')}
        </table>
        <p style="margin-top: 20px;">Please review and take immediate action on these assets.</p>
      `;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'KPI Fleet IQ - HVNL Risk Alerts',
          to: 'fleet.manager@kpi.com.au',
          subject: `🚨 HVNL High-Risk Assets Alert (${highRiskAssets.length} assets)`,
          body: emailBody,
        });
      } catch (emailError) {
        console.error('Failed to send HVNL risk notification:', emailError);
      }
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      total_hvnl_assets: riskScores.length,
      high_risk_count: highRiskAssets.length,
      risk_scores: riskScores,
    });

  } catch (error) {
    console.error('HVNL risk score calculation error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});