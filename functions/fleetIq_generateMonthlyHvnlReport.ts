import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get previous calendar month
    const now = new Date();
    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const reportMonth = firstDayPrevMonth.toLocaleString('en-AU', { month: 'long', year: 'numeric' });

    const monthStart = firstDayPrevMonth.toISOString();
    const monthEnd = lastDayPrevMonth.toISOString();

    // Fetch all required data
    console.log('Fetching data for report period:', reportMonth);
    
    const [vehicles, prestarts, incidents, defects, serviceRecords, riskStatuses] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.PrestartCheck.filter({}, '-prestart_datetime', 5000),
      base44.asServiceRole.entities.IncidentRecord.filter({}, '-incident_datetime', 2000),
      base44.asServiceRole.entities.PrestartDefect.filter({}, '-reported_at', 2000),
      base44.asServiceRole.entities.ServiceRecord.filter({}, '-service_date', 1000),
      base44.asServiceRole.entities.WorkerRiskStatus.list('-last_updated_datetime', 500),
    ]);

    // Create vehicle lookup
    const vehicleMap = {};
    vehicles.forEach(v => vehicleMap[v.id] = v);

    // Filter data for report month
    const monthPrestarts = prestarts.filter(p => 
      p.prestart_datetime >= monthStart && p.prestart_datetime <= monthEnd
    );

    const monthIncidents = incidents.filter(inc =>
      inc.incident_datetime >= monthStart && inc.incident_datetime <= monthEnd
    );

    const hvnlIncidents = monthIncidents.filter(inc => inc.incident_type === 'HVNL Breach');

    // National Statistics
    const totalPrestarts = monthPrestarts.length;
    const failedPrestarts = monthPrestarts.filter(p => p.overall_result === 'Fail').length;
    const prestartCompliance = totalPrestarts > 0 ? ((totalPrestarts - failedPrestarts) / totalPrestarts * 100).toFixed(1) : 100;

    const totalIncidents = monthIncidents.length;
    const hvnlBreaches = hvnlIncidents.length;
    const criticalIncidents = monthIncidents.filter(inc => inc.severity === 'Critical' || inc.severity === 'Serious').length;

    const totalDefects = defects.filter(d => {
      const prestart = prestarts.find(p => p.id === d.prestart_id);
      return prestart && prestart.prestart_datetime >= monthStart && prestart.prestart_datetime <= monthEnd;
    }).length;

    const criticalDefects = defects.filter(d => {
      const prestart = prestarts.find(p => p.id === d.prestart_id);
      return prestart && prestart.prestart_datetime >= monthStart && prestart.prestart_datetime <= monthEnd && d.severity === 'Critical';
    }).length;

    // Service Compliance
    const overdueService = vehicles.filter(v => {
      if (!v.next_service_due_date) return false;
      return new Date(v.next_service_due_date) < lastDayPrevMonth;
    }).length;

    const serviceCompliance = vehicles.length > 0 ? (((vehicles.length - overdueService) / vehicles.length) * 100).toFixed(1) : 100;

    // State Breakdown
    const states = ['VIC', 'NSW', 'QLD', 'TAS', 'NT', 'ACT'];
    const stateStats = {};

    states.forEach(state => {
      const stateVehicles = vehicles.filter(v => v.state === state);
      const stateVehicleIds = new Set(stateVehicles.map(v => v.id));

      const statePrestarts = monthPrestarts.filter(p => stateVehicleIds.has(p.vehicle_id));
      const stateIncidents = monthIncidents.filter(inc => {
        const vehicle = vehicleMap[inc.vehicle_id];
        return vehicle && vehicle.state === state;
      });

      stateStats[state] = {
        vehicles: stateVehicles.length,
        prestarts: statePrestarts.length,
        failed_prestarts: statePrestarts.filter(p => p.overall_result === 'Fail').length,
        incidents: stateIncidents.length,
        hvnl_breaches: stateIncidents.filter(inc => inc.incident_type === 'HVNL Breach').length,
        compliance: statePrestarts.length > 0 ? 
          (((statePrestarts.length - statePrestarts.filter(p => p.overall_result === 'Fail').length) / statePrestarts.length) * 100).toFixed(1) : 
          100,
      };
    });

    // High-Risk Workers
    const highRiskWorkers = riskStatuses
      .filter(s => s.current_risk_level === 'Red' || s.current_risk_level === 'Amber')
      .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
      .slice(0, 20);

    // High-Risk Vehicles (most incidents/defects)
    const vehicleIssues = {};
    monthIncidents.forEach(inc => {
      if (!vehicleIssues[inc.vehicle_id]) {
        vehicleIssues[inc.vehicle_id] = { incidents: 0, defects: 0 };
      }
      vehicleIssues[inc.vehicle_id].incidents++;
    });

    defects.forEach(d => {
      const prestart = prestarts.find(p => p.id === d.prestart_id);
      if (prestart && prestart.prestart_datetime >= monthStart && prestart.prestart_datetime <= monthEnd) {
        if (!vehicleIssues[prestart.vehicle_id]) {
          vehicleIssues[prestart.vehicle_id] = { incidents: 0, defects: 0 };
        }
        vehicleIssues[prestart.vehicle_id].defects++;
      }
    });

    const highRiskVehicles = Object.entries(vehicleIssues)
      .map(([vehicleId, issues]) => ({
        vehicle: vehicleMap[vehicleId],
        ...issues,
        total: issues.incidents + issues.defects,
      }))
      .filter(v => v.vehicle)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // HVNL Categories Breakdown
    const hvnlCategories = {};
    hvnlIncidents.forEach(inc => {
      const category = inc.hvnl_breach_type || 'General HVNL';
      hvnlCategories[category] = (hvnlCategories[category] || 0) + 1;
    });

    // Generate HTML Email
    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; opacity: 0.9; }
    .section { margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5; }
    .section h2 { color: #4f46e5; margin-top: 0; font-size: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .stat-value { font-size: 32px; font-weight: bold; color: #1e293b; }
    .stat-label { font-size: 14px; color: #64748b; margin-top: 5px; }
    .compliance-good { color: #10b981; }
    .compliance-warning { color: #f59e0b; }
    .compliance-critical { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; }
    th { background: #4f46e5; color: white; padding: 12px; text-align: left; font-weight: 600; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:hover { background: #f8fafc; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .alert-box { background: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 15px; margin: 20px 0; }
    .alert-box h3 { color: #991b1b; margin-top: 0; }
    .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚛 KPI - Fleet IQ Monthly HVNL & CoR Compliance Report</h1>
    <p>Report Period: ${reportMonth}</p>
    <p>Generated: ${new Date().toLocaleString('en-AU', { dateStyle: 'full', timeStyle: 'short' })}</p>
  </div>

  <div class="section">
    <h2>📊 National Overview</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value ${prestartCompliance >= 95 ? 'compliance-good' : prestartCompliance >= 85 ? 'compliance-warning' : 'compliance-critical'}">${prestartCompliance}%</div>
        <div class="stat-label">Prestart Compliance</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalPrestarts.toLocaleString()}</div>
        <div class="stat-label">Total Prestarts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value compliance-critical">${hvnlBreaches}</div>
        <div class="stat-label">HVNL Breaches</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalIncidents}</div>
        <div class="stat-label">Total Incidents</div>
      </div>
      <div class="stat-card">
        <div class="stat-value compliance-warning">${criticalDefects}</div>
        <div class="stat-label">Critical Defects</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ${serviceCompliance >= 95 ? 'compliance-good' : 'compliance-warning'}">${serviceCompliance}%</div>
        <div class="stat-label">Service Compliance</div>
      </div>
    </div>
  </div>

  ${hvnlBreaches > 0 ? `
  <div class="alert-box">
    <h3>⚠️ HVNL Breach Alert</h3>
    <p><strong>${hvnlBreaches} HVNL breach(es)</strong> recorded during ${reportMonth}. Immediate review and corrective action required.</p>
  </div>
  ` : ''}

  <div class="section">
    <h2>🗺️ State-by-State Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>State</th>
          <th>Vehicles</th>
          <th>Prestarts</th>
          <th>Failed</th>
          <th>Incidents</th>
          <th>HVNL</th>
          <th>Compliance</th>
        </tr>
      </thead>
      <tbody>
        ${states.map(state => `
        <tr>
          <td><strong>${state}</strong></td>
          <td>${stateStats[state].vehicles}</td>
          <td>${stateStats[state].prestarts}</td>
          <td>${stateStats[state].failed_prestarts}</td>
          <td>${stateStats[state].incidents}</td>
          <td>${stateStats[state].hvnl_breaches}</td>
          <td><span class="${stateStats[state].compliance >= 95 ? 'compliance-good' : stateStats[state].compliance >= 85 ? 'compliance-warning' : 'compliance-critical'}">${stateStats[state].compliance}%</span></td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  ${Object.keys(hvnlCategories).length > 0 ? `
  <div class="section">
    <h2>📋 HVNL Breach Categories</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(hvnlCategories).map(([category, count]) => `
        <tr>
          <td>${category}</td>
          <td><strong>${count}</strong></td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${highRiskWorkers.length > 0 ? `
  <div class="section">
    <h2>👷 High-Risk Workers</h2>
    <table>
      <thead>
        <tr>
          <th>Worker Name</th>
          <th>Risk Level</th>
          <th>Failed Prestarts</th>
          <th>Incidents</th>
          <th>HVNL</th>
          <th>Risk Score</th>
        </tr>
      </thead>
      <tbody>
        ${highRiskWorkers.map(worker => `
        <tr>
          <td><strong>${worker.worker_name}</strong></td>
          <td><span class="badge badge-${worker.current_risk_level.toLowerCase()}">${worker.current_risk_level}</span></td>
          <td>${worker.failed_prestarts_90d || 0}</td>
          <td>${worker.incidents_12m || 0}</td>
          <td>${worker.hvnl_incidents_12m || 0}</td>
          <td><strong>${worker.risk_score || 0}</strong></td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${highRiskVehicles.length > 0 ? `
  <div class="section">
    <h2>🚨 High-Risk Vehicles</h2>
    <table>
      <thead>
        <tr>
          <th>Asset Code</th>
          <th>Registration</th>
          <th>Type</th>
          <th>Incidents</th>
          <th>Defects</th>
          <th>Total Issues</th>
        </tr>
      </thead>
      <tbody>
        ${highRiskVehicles.map(v => `
        <tr>
          <td><strong>${v.vehicle.asset_code}</strong></td>
          <td>${v.vehicle.rego || '-'}</td>
          <td>${v.vehicle.asset_type}</td>
          <td>${v.incidents}</td>
          <td>${v.defects}</td>
          <td><strong>${v.total}</strong></td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <h2>📝 Summary & Recommendations</h2>
    <ul>
      ${prestartCompliance < 95 ? '<li><strong>Action Required:</strong> Prestart compliance below target (95%). Implement additional training and supervision.</li>' : '<li>✅ Prestart compliance meets target standards.</li>'}
      ${hvnlBreaches > 0 ? `<li><strong>Critical:</strong> ${hvnlBreaches} HVNL breach(es) require immediate investigation and corrective action.</li>` : '<li>✅ No HVNL breaches recorded this period.</li>'}
      ${highRiskWorkers.length > 0 ? `<li><strong>Worker Risk:</strong> ${highRiskWorkers.length} high-risk workers identified. Mandatory safety reviews required.</li>` : '<li>✅ No high-risk workers flagged.</li>'}
      ${overdueService > 0 ? `<li><strong>Maintenance:</strong> ${overdueService} vehicles overdue for service. Schedule immediate attention.</li>` : '<li>✅ Fleet service compliance on track.</li>'}
      <li><strong>Next Steps:</strong> Review detailed CSV attachment for complete data. Schedule state manager briefings as required.</li>
    </ul>
  </div>

  <div class="footer">
    <p><strong>KPI - Fleet IQ</strong> | Automated Monthly Compliance Report</p>
    <p>For detailed analysis, log in to Fleet IQ Dashboard</p>
  </div>
</body>
</html>
    `.trim();

    // Generate CSV Data
    const csvRows = [
      ['KPI - Fleet IQ Monthly HVNL & CoR Compliance Report'],
      ['Report Period:', reportMonth],
      ['Generated:', new Date().toLocaleString('en-AU')],
      [''],
      ['NATIONAL STATISTICS'],
      ['Metric', 'Value'],
      ['Total Prestarts', totalPrestarts],
      ['Failed Prestarts', failedPrestarts],
      ['Prestart Compliance %', prestartCompliance],
      ['Total Incidents', totalIncidents],
      ['HVNL Breaches', hvnlBreaches],
      ['Critical Incidents', criticalIncidents],
      ['Total Defects', totalDefects],
      ['Critical Defects', criticalDefects],
      ['Service Compliance %', serviceCompliance],
      ['Overdue Services', overdueService],
      [''],
      ['STATE BREAKDOWN'],
      ['State', 'Vehicles', 'Prestarts', 'Failed', 'Incidents', 'HVNL', 'Compliance %'],
      ...states.map(state => [
        state,
        stateStats[state].vehicles,
        stateStats[state].prestarts,
        stateStats[state].failed_prestarts,
        stateStats[state].incidents,
        stateStats[state].hvnl_breaches,
        stateStats[state].compliance,
      ]),
      [''],
      ['HIGH-RISK WORKERS'],
      ['Worker Name', 'Risk Level', 'Failed Prestarts (90d)', 'Incidents (12m)', 'HVNL (12m)', 'Risk Score'],
      ...highRiskWorkers.map(w => [
        w.worker_name,
        w.current_risk_level,
        w.failed_prestarts_90d || 0,
        w.incidents_12m || 0,
        w.hvnl_incidents_12m || 0,
        w.risk_score || 0,
      ]),
      [''],
      ['HIGH-RISK VEHICLES'],
      ['Asset Code', 'Registration', 'Type', 'Incidents', 'Defects', 'Total Issues'],
      ...highRiskVehicles.map(v => [
        v.vehicle.asset_code,
        v.vehicle.rego || '',
        v.vehicle.asset_type,
        v.incidents,
        v.defects,
        v.total,
      ]),
    ];

    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // Send Email with Attachment
    const emailRecipients = [
      'hse.manager@kpi.com.au',
      'fleet.manager@kpi.com.au',
      'state.ops@kpi.com.au',
      'national.compliance@kpi.com.au',
    ];

    for (const recipient of emailRecipients) {
      try {
        // Upload CSV as a file first
        const csvBlob = new Blob([csvContent], { type: 'text/csv' });
        const csvFile = new File([csvBlob], `HVNL_Report_${reportMonth.replace(' ', '_')}.csv`);
        
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({
          file: csvFile,
        });

        // Send email (note: current Core.SendEmail doesn't support attachments directly)
        // In production, you would use a service that supports attachments or include the CSV URL
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: 'KPI Fleet IQ - Monthly Reports',
          to: recipient,
          subject: `📊 Monthly HVNL Report - ${reportMonth}`,
          body: htmlEmail + `\n\nCSV Report Download: ${file_url}`,
        });
      } catch (emailError) {
        console.error(`Failed to send email to ${recipient}:`, emailError);
      }
    }

    return Response.json({
      success: true,
      report_period: reportMonth,
      timestamp: new Date().toISOString(),
      statistics: {
        prestart_compliance: prestartCompliance,
        hvnl_breaches: hvnlBreaches,
        total_incidents: totalIncidents,
        high_risk_workers: highRiskWorkers.length,
        high_risk_vehicles: highRiskVehicles.length,
      },
      emails_sent: emailRecipients.length,
    });

  } catch (error) {
    console.error('Monthly report generation error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});