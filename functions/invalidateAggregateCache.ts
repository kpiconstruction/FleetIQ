import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { invalidateCache, getCacheStats } from './services/aggregateCache.js';
import { hasPermission } from './checkPermissions.js';

/**
 * Manual cache invalidation endpoint for Fleet IQ aggregates
 * Use this after bulk data imports or when you need fresh data
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only FleetAdmin can manually invalidate cache
    if (!hasPermission(user, 'editAutomationSettings')) {
      return Response.json({ 
        error: 'Forbidden: Only FleetAdmin can invalidate cache',
        yourRole: user.fleet_role || 'None'
      }, { status: 403 });
    }

    const body = await req.json();
    const { functionName = null } = body;

    const statsBefore = getCacheStats();

    // Invalidate cache
    invalidateCache(functionName);

    const statsAfter = getCacheStats();

    return Response.json({
      success: true,
      message: functionName 
        ? `Cache cleared for ${functionName}` 
        : 'All cache cleared',
      before: statsBefore,
      after: statsAfter,
    });

  } catch (error) {
    console.error('Cache invalidation error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});