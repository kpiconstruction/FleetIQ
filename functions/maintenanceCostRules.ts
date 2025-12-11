/**
 * Centralized maintenance cost rules for KPI Fleet IQ
 * 
 * Business Rules:
 * - Owned vehicles: Full costs allowed for all services/repairs
 * - Hire vehicles (ContractHire/DayHire):
 *   - Scheduled/routine servicing: NO KPI cost (provider-paid)
 *   - Damage/fault repairs: KPI cost ONLY if we caused it
 */

/**
 * Apply cost rules to a service record based on vehicle ownership and service context
 * 
 * @param {Object} params
 * @param {Object} params.vehicle - Vehicle entity
 * @param {Object} params.workOrder - MaintenanceWorkOrder entity (optional)
 * @param {Object} params.serviceRecord - Draft ServiceRecord data
 * @returns {Object} Modified serviceRecord with cost rules applied
 */
export function applyCostRulesForServiceRecord({ vehicle, workOrder, serviceRecord }) {
  const ownershipType = vehicle?.ownership_type;
  
  // Owned vehicles: no restrictions, just default cost_chargeable_to
  if (ownershipType === 'Owned') {
    return {
      ...serviceRecord,
      cost_chargeable_to: serviceRecord.cost_chargeable_to || 'KPI'
    };
  }

  // Hire vehicles: apply cost rules
  if (ownershipType === 'ContractHire' || ownershipType === 'DayHire') {
    // Determine if this is scheduled service or repair
    const isScheduledService = isScheduledServiceContext(serviceRecord, workOrder);
    
    if (isScheduledService) {
      // Scheduled service for hire: zero all costs, mark as provider-paid
      const hadNonZeroCosts = 
        (serviceRecord.cost_ex_gst && serviceRecord.cost_ex_gst > 0) ||
        (serviceRecord.labour_cost && serviceRecord.labour_cost > 0) ||
        (serviceRecord.parts_cost && serviceRecord.parts_cost > 0);
      
      return {
        ...serviceRecord,
        cost_ex_gst: 0,
        labour_cost: 0,
        parts_cost: 0,
        cost_chargeable_to: 'HireProvider',
        notes: hadNonZeroCosts 
          ? `${serviceRecord.notes || ''}\n[AUTO] Reset hire scheduled service costs to 0 (provider-paid).`.trim()
          : serviceRecord.notes
      };
    } else {
      // Repair/corrective work on hire vehicle
      const costChargeableTo = serviceRecord.cost_chargeable_to;
      
      if (costChargeableTo === 'HireProvider') {
        // Provider paying for repair: zero costs
        return {
          ...serviceRecord,
          cost_ex_gst: 0,
          labour_cost: 0,
          parts_cost: 0,
          cost_chargeable_to: 'HireProvider'
        };
      } else if (costChargeableTo === 'KPI') {
        // KPI at-fault repair: allow costs
        return {
          ...serviceRecord,
          cost_chargeable_to: 'KPI'
        };
      } else {
        // Client or Shared: allow costs as specified
        return serviceRecord;
      }
    }
  }

  // Unknown ownership type: return as-is with default
  return {
    ...serviceRecord,
    cost_chargeable_to: serviceRecord.cost_chargeable_to || 'Unknown'
  };
}

/**
 * Determine if a service record represents scheduled/routine service
 * 
 * @param {Object} serviceRecord - Draft ServiceRecord
 * @param {Object} workOrder - MaintenanceWorkOrder (optional)
 * @returns {boolean}
 */
function isScheduledServiceContext(serviceRecord, workOrder) {
  // Check service_type
  const scheduledServiceTypes = ['Scheduled', 'HireProviderService', 'Warranty'];
  if (serviceRecord.service_type && scheduledServiceTypes.includes(serviceRecord.service_type)) {
    return true;
  }

  // Check work order context
  if (workOrder) {
    if (workOrder.work_order_type === 'Scheduled' && workOrder.raised_from === 'Schedule') {
      return true;
    }
  }

  return false;
}

/**
 * Detect anomalies in service records (hire scheduled services with non-zero costs)
 * 
 * @param {Object} serviceRecord - ServiceRecord entity
 * @param {Object} vehicle - Vehicle entity
 * @returns {boolean} True if anomaly detected
 */
export function detectCostAnomaly(serviceRecord, vehicle) {
  if (vehicle.ownership_type !== 'ContractHire' && vehicle.ownership_type !== 'DayHire') {
    return false;
  }

  const scheduledServiceTypes = ['Scheduled', 'HireProviderService', 'Warranty'];
  const isScheduled = scheduledServiceTypes.includes(serviceRecord.service_type);
  
  if (!isScheduled) {
    return false;
  }

  // Anomaly: hire scheduled service with non-zero cost
  return (serviceRecord.cost_ex_gst || 0) > 0;
}