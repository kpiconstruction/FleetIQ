/**
 * Helper function to retrieve notification email from NotificationConfig
 * @param {Object} base44 - Base44 SDK client instance
 * @param {string} key - Configuration key (e.g. "FleetManagerEmail")
 * @returns {Promise<string|null>} Email address or null if not found
 */
export async function getNotificationEmail(base44, key) {
  try {
    const configs = await base44.asServiceRole.entities.NotificationConfig.filter({ key });
    if (configs && configs.length > 0) {
      return configs[0].value;
    }
    console.error(`NotificationConfig key not found: ${key}`);
    return null;
  } catch (error) {
    console.error(`Error fetching NotificationConfig for key ${key}:`, error);
    return null;
  }
}

/**
 * Get multiple notification emails
 * @param {Object} base44 - Base44 SDK client instance
 * @param {Array<string>} keys - Array of configuration keys
 * @returns {Promise<Array<string>>} Array of email addresses (filters out nulls)
 */
export async function getNotificationEmails(base44, keys) {
  const emails = await Promise.all(keys.map(key => getNotificationEmail(base44, key)));
  return emails.filter(email => email !== null);
}