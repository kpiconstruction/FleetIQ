/**
 * Fleet IQ Logging & Error Handling Service
 * Provides standardized logging for automations, alerts, and audit trails
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Log an automation run (scheduled job, background task)
 * @param {Object} base44 - Base44 client (service role)
 * @param {string} name - Automation name (e.g., "autoCreatePlanWorkOrders")
 * @param {string} status - "Success" | "Failed" | "PartialSuccess"
 * @param {Object} meta - Metadata (count, errors, warnings, duration, etc.)
 */
export async function logAutomationRun(base44, name, status, meta = {}) {
  try {
    console.log(`[AutomationLog] ${name} - ${status}`, meta);
    
    // Store in a simple log format (could extend to custom AutomationLog entity if needed)
    // For now, use console + optional AlertLog for failures
    if (status === 'Failed') {
      await base44.asServiceRole.entities.AlertLog.create({
        alert_type: 'ScheduledReport',
        sent_at: new Date().toISOString(),
        recipients: 'system',
        subject: `Automation Failed: ${name}`,
        related_entity_type: 'Automation',
        related_entity_id: name,
        status: 'Failed',
        error_message: meta.error || 'Unknown error',
      });
    }
  } catch (error) {
    console.error('[AutomationLog] Failed to log automation run:', error);
  }
}

/**
 * Log an alert send (email, notification)
 * @param {Object} base44 - Base44 client (service role)
 * @param {string} alertType - Alert type (e.g., "MaintenancePlanStatus")
 * @param {string} recipients - Comma-separated email addresses
 * @param {string} subject - Email subject
 * @param {string} relatedEntityType - Entity type (Vehicle, MaintenancePlan, etc.)
 * @param {string} relatedEntityId - Entity ID
 * @param {string} status - "Success" | "Failed"
 * @param {string} errorMessage - Error details if failed
 */
export async function logAlertSend(
  base44,
  alertType,
  recipients,
  subject,
  relatedEntityType,
  relatedEntityId,
  status,
  errorMessage = null
) {
  try {
    await base44.asServiceRole.entities.AlertLog.create({
      alert_type: alertType,
      sent_at: new Date().toISOString(),
      recipients,
      subject,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      status,
      error_message: errorMessage,
    });
  } catch (error) {
    console.error('[AlertLog] Failed to log alert:', error);
  }
}

/**
 * Get notification email from config with fallback
 * @param {Object} base44 - Base44 client (service role)
 * @param {string} configKey - Config key (e.g., "OVERDUE_MAINTENANCE_ALERT_EMAIL")
 * @param {string} fallbackEmail - Fallback email if config missing
 * @returns {Promise<string>} Email address
 */
export async function getNotificationEmailSafe(base44, configKey, fallbackEmail = null) {
  try {
    const configs = await base44.asServiceRole.entities.NotificationConfig.filter({ key: configKey });
    if (configs.length > 0 && configs[0].value) {
      return configs[0].value;
    }

    console.warn(`[Config] Missing NotificationConfig: ${configKey}, using fallback: ${fallbackEmail}`);
    
    // Log missing config warning
    await logAlertSend(
      base44,
      'ScheduledReport',
      'system',
      `Missing NotificationConfig: ${configKey}`,
      'NotificationConfig',
      configKey,
      'Failed',
      `Config key ${configKey} not found. No alert sent.`
    );

    return fallbackEmail;
  } catch (error) {
    console.error('[Config] Error fetching notification email:', error);
    return fallbackEmail;
  }
}

/**
 * Check if automation is enabled via AutomationConfig
 * @param {Object} base44 - Base44 client (service role)
 * @param {string} configKey - Config key (e.g., "AUTO_WO_FROM_PLANS_ENABLED")
 * @returns {Promise<boolean>} Whether automation is enabled
 */
export async function isAutomationEnabled(base44, configKey) {
  try {
    const configs = await base44.asServiceRole.entities.AutomationConfig.filter({ key: configKey });
    if (configs.length > 0) {
      const value = configs[0].value;
      const valueType = configs[0].value_type || 'boolean';
      
      if (valueType === 'boolean') {
        return value === 'true' || value === true;
      }
    }
    
    // Default to disabled if not found
    console.warn(`[Config] AutomationConfig ${configKey} not found, defaulting to disabled`);
    return false;
  } catch (error) {
    console.error('[Config] Error checking automation config:', error);
    return false;
  }
}

/**
 * Wrap an automation function with error handling and logging
 * @param {Function} fn - Async function to wrap
 * @param {string} name - Automation name
 * @returns {Function} Wrapped function
 */
export function wrapAutomation(fn, name) {
  return async (req) => {
    const startTime = Date.now();
    let base44;
    
    try {
      base44 = createClientFromRequest(req);
      
      // Execute automation
      const result = await fn(req, base44);
      
      const duration = Date.now() - startTime;
      await logAutomationRun(base44, name, 'Success', { 
        duration: `${duration}ms`,
        ...result.meta,
      });
      
      return result.response;
    } catch (error) {
      console.error(`[Automation] ${name} failed:`, error);
      
      const duration = Date.now() - startTime;
      if (base44) {
        await logAutomationRun(base44, name, 'Failed', {
          error: error.message,
          stack: error.stack,
          duration: `${duration}ms`,
        });
      }
      
      return Response.json({
        success: false,
        error: error.message,
        automation: name,
      }, { status: 500 });
    }
  };
}