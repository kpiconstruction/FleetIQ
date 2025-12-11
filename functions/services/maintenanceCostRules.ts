/**
 * Centralized maintenance cost rules and anomaly detection
 * This is the SINGLE SOURCE OF TRUTH for cost attribution logic
 */

/**
 * Apply maintenance cost rules based on vehicle ownership and service type
 * @param {Object} params
 * @param {Object} params.serviceRecord - The service record data
 * @param {Object} params.vehicle - The vehicle entity
 * @param {Object} params.workOrder - Optional work order entity
 * @param {Array} params.recentServices - Optional array of recent services for anomaly detection
 * @returns {Object} Cleaned service record with cost_chargeable_to set and anomaly flags
 */
export function applyMaintenanceCostRules({ serviceRecord, vehicle, workOrder = null, recentServices = [] }) {
  const cleanedRecord = { ...serviceRecord };
  const ownershipType = vehicle.ownership_type;
  const serviceType = cleanedRecord.service_type;
  const workOrderType = workOrder?.work_order_type;
  
  // Initialize anomaly tracking
  const anomalies = [];

  // ========================================
  // COST ATTRIBUTION RULES
  // ========================================

  // OWNED FLEET RULES
  if (ownershipType === 'Owned') {
    // Default to KPI if not set
    if (!cleanedRecord.cost_chargeable_to) {
      cleanedRecord.cost_chargeable_to = 'KPI';
    }
    // Allow all cost fields as entered (no forcing to zero)
  }

  // HIRE FLEET RULES (ContractHire or DayHire)
  else if (ownershipType === 'ContractHire' || ownershipType === 'DayHire') {
    
    // Rule 1: Scheduled/HireProviderService/Warranty defaults to HireProvider responsibility
    if (['Scheduled', 'HireProviderService', 'Warranty'].includes(serviceType)) {
      // If not explicitly set to KPI, force to HireProvider
      if (cleanedRecord.cost_chargeable_to !== 'KPI') {
        cleanedRecord.cost_chargeable_to = 'HireProvider';
        // Zero out costs for hire provider services
        cleanedRecord.cost_ex_gst = 0;
        cleanedRecord.labour_cost = 0;
        cleanedRecord.parts_cost = 0;
      }
      // If explicitly KPI, allow costs as entered
    }

    // Rule 2: Corrective/DefectRepair - depends on work order type
    else if (workOrderType && ['Corrective', 'DefectRepair'].includes(workOrderType)) {
      // Allow costs only when chargeable to KPI, Client, or Shared
      if (['KPI', 'Client', 'Shared'].includes(cleanedRecord.cost_chargeable_to)) {
        // Allow costs as entered
      } else {
        // If HireProvider or null, force to HireProvider with zero cost
        cleanedRecord.cost_chargeable_to = 'HireProvider';
        cleanedRecord.cost_ex_gst = 0;
        cleanedRecord.labour_cost = 0;
        cleanedRecord.parts_cost = 0;
      }
    }

    // Rule 3: Breakdown always allows costs (generally KPI or shared)
    else if (serviceType === 'Breakdown') {
      if (!cleanedRecord.cost_chargeable_to) {
        cleanedRecord.cost_chargeable_to = 'KPI'; // Default for breakdowns
      }
      // Allow costs as entered
    }

    // Default fallback for hire fleet
    else {
      if (!cleanedRecord.cost_chargeable_to) {
        cleanedRecord.cost_chargeable_to = 'HireProvider';
      }
    }
  }

  // Unknown ownership type - default to KPI
  else {
    if (!cleanedRecord.cost_chargeable_to) {
      cleanedRecord.cost_chargeable_to = 'KPI';
    }
  }

  // ========================================
  // ANOMALY DETECTION
  // ========================================

  const totalCost = cleanedRecord.cost_ex_gst || 0;
  const labourCost = cleanedRecord.labour_cost || 0;
  const partsCost = cleanedRecord.parts_cost || 0;

  // Anomaly 1: Hire fleet scheduled/provider service with non-zero cost
  if ((ownershipType === 'ContractHire' || ownershipType === 'DayHire') &&
      ['Scheduled', 'HireProviderService', 'Warranty'].includes(serviceType) &&
      totalCost > 0 &&
      cleanedRecord.cost_chargeable_to === 'HireProvider') {
    anomalies.push('Hire fleet scheduled service should have zero cost');
  }

  // Anomaly 2: Owned scheduled service with zero cost (but previous services had cost)
  if (ownershipType === 'Owned' && serviceType === 'Scheduled' && totalCost === 0) {
    const previousScheduledCosts = recentServices
      .filter(s => s.service_type === 'Scheduled' && (s.cost_ex_gst || 0) > 0)
      .slice(0, 3); // Check last 3 scheduled services
    
    if (previousScheduledCosts.length > 0) {
      anomalies.push('Owned fleet scheduled service with zero cost (previous services had cost)');
    }
  }

  // Anomaly 3: Labour + Parts doesn't match total cost (allow 5% tolerance or $10)
  if (totalCost > 0 && (labourCost > 0 || partsCost > 0)) {
    const componentSum = labourCost + partsCost;
    const difference = Math.abs(totalCost - componentSum);
    const tolerance = Math.max(totalCost * 0.05, 10); // 5% or $10
    
    if (difference > tolerance) {
      anomalies.push(`Cost breakdown mismatch: Total ${totalCost} vs Labour+Parts ${componentSum}`);
    }
  }

  // Anomaly 4: Repeat repairs (same vehicle, similar issue, short timeframe)
  if (cleanedRecord.notes && totalCost > 500) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const serviceDate = cleanedRecord.service_date ? new Date(cleanedRecord.service_date) : new Date();
    
    const recentSimilarServices = recentServices.filter(s => {
      const sDate = new Date(s.service_date);
      return sDate >= thirtyDaysAgo && 
             sDate < serviceDate &&
             (s.cost_ex_gst || 0) > 500 &&
             s.notes && 
             detectSimilarIssue(cleanedRecord.notes, s.notes);
    });

    if (recentSimilarServices.length > 0) {
      anomalies.push(`Potential repeat repair (${recentSimilarServices.length} similar services in last 30 days)`);
    }
  }

  // Anomaly 5: Unusually high cost for service type
  if (totalCost > 0) {
    const avgCostForType = calculateAverageForServiceType(serviceType, recentServices);
    if (avgCostForType > 0 && totalCost > avgCostForType * 3) {
      anomalies.push(`Unusually high cost: ${totalCost} vs avg ${Math.round(avgCostForType)}`);
    }
  }

  // Set anomaly flags
  cleanedRecord.cost_anomaly_flag = anomalies.length > 0;
  cleanedRecord.cost_anomaly_reason = anomalies.length > 0 ? anomalies.join('; ') : null;

  return cleanedRecord;
}

/**
 * Detect if two service notes describe similar issues
 */
function detectSimilarIssue(notes1, notes2) {
  if (!notes1 || !notes2) return false;
  
  const n1 = notes1.toLowerCase();
  const n2 = notes2.toLowerCase();
  
  // Common component keywords
  const keywords = [
    'brake', 'transmission', 'engine', 'suspension', 'alternator', 
    'starter', 'battery', 'clutch', 'tyre', 'tire', 'radiator',
    'pump', 'sensor', 'filter', 'belt', 'hose', 'light', 'electrical'
  ];
  
  for (const keyword of keywords) {
    if (n1.includes(keyword) && n2.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate average cost for a service type from recent services
 */
function calculateAverageForServiceType(serviceType, recentServices) {
  const matchingServices = recentServices.filter(s => 
    s.service_type === serviceType && (s.cost_ex_gst || 0) > 0
  );
  
  if (matchingServices.length === 0) return 0;
  
  const totalCost = matchingServices.reduce((sum, s) => sum + (s.cost_ex_gst || 0), 0);
  return totalCost / matchingServices.length;
}

/**
 * Validate that cost fields are consistent
 * @param {Object} serviceRecord
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateServiceRecordCosts(serviceRecord) {
  const errors = [];
  
  const totalCost = serviceRecord.cost_ex_gst || 0;
  const labourCost = serviceRecord.labour_cost || 0;
  const partsCost = serviceRecord.parts_cost || 0;
  
  // Negative costs
  if (totalCost < 0) errors.push('Total cost cannot be negative');
  if (labourCost < 0) errors.push('Labour cost cannot be negative');
  if (partsCost < 0) errors.push('Parts cost cannot be negative');
  
  // Labour + Parts exceeds total (with small tolerance)
  if (labourCost + partsCost > totalCost + 1) {
    errors.push('Labour + Parts cost exceeds total cost');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}