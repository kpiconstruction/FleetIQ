import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { getBestOdometerSnapshot } from './services/odometerSnapshot.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      stateFilter = 'all',
      functionClassFilter = 'all',
      depotFilter = 'all',
    } = body;

    // Fetch all vehicles
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();

    // Filter vehicles
    const filteredVehicles = vehicles.filter(v => {
      if (stateFilter !== 'all' && v.state !== stateFilter) return false;
      if (functionClassFilter !== 'all' && v.vehicle_function_class !== functionClassFilter) return false;
      if (depotFilter !== 'all' && v.primary_depot !== depotFilter) return false;
      return true;
    });

    // Get odometer snapshots for all filtered vehicles
    const vehicleSnapshots = [];
    const exceptionsList = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const vehicle of filteredVehicles) {
      const snapshot = await getBestOdometerSnapshot(base44, vehicle.id);

      vehicleSnapshots.push({
        vehicle_id: vehicle.id,
        asset_code: vehicle.asset_code,
        rego: vehicle.rego,
        state: vehicle.state,
        primary_depot: vehicle.primary_depot,
        vehicle_function_class: vehicle.vehicle_function_class,
        ...snapshot,
      });

      // Check for exceptions
      const exceptions = [];

      // Check for consecutive low confidence readings
      const recentPrestarts = await base44.asServiceRole.entities.PrestartCheck.filter(
        { vehicle_id: vehicle.id },
        '-prestart_datetime',
        10
      );

      const lowConfidenceCount = recentPrestarts
        .filter(p => p.odometer_confidence === 'Low')
        .length;

      if (lowConfidenceCount >= 3) {
        exceptions.push('RepeatedLow');
      }

      // Check for backwards odometer in last 30 days
      const recentPrestartsWithOdo = recentPrestarts.filter(
        p => p.odometer_km && p.odometer_km > 0 && new Date(p.prestart_datetime) >= thirtyDaysAgo
      );

      for (let i = 1; i < recentPrestartsWithOdo.length; i++) {
        const current = recentPrestartsWithOdo[i - 1];
        const previous = recentPrestartsWithOdo[i];
        if (current.odometer_km < previous.odometer_km) {
          exceptions.push('Backwards');
          break;
        }
      }

      // Check for extreme jumps in last 30 days
      for (let i = 1; i < recentPrestartsWithOdo.length; i++) {
        const current = recentPrestartsWithOdo[i - 1];
        const previous = recentPrestartsWithOdo[i];
        const odometerDiff = current.odometer_km - previous.odometer_km;
        const currentDate = new Date(current.prestart_datetime);
        const previousDate = new Date(previous.prestart_datetime);
        const hoursDiff = (currentDate - previousDate) / (1000 * 60 * 60);

        if (hoursDiff > 0 && hoursDiff < 24 && odometerDiff > 2000) {
          exceptions.push('ExtremeJump');
          break;
        }
      }

      if (exceptions.length > 0) {
        exceptionsList.push({
          vehicle_id: vehicle.id,
          asset_code: vehicle.asset_code,
          rego: vehicle.rego,
          state: vehicle.state,
          primary_depot: vehicle.primary_depot,
          last_snapshot_datetime: snapshot.last_reading_datetime,
          confidence: snapshot.confidence,
          exception_types: [...new Set(exceptions)], // Remove duplicates
        });
      }
    }

    // Group by confidence level
    const byConfidence = {
      High: vehicleSnapshots.filter(v => v.confidence === 'High').length,
      Medium: vehicleSnapshots.filter(v => v.confidence === 'Medium').length,
      Low: vehicleSnapshots.filter(v => v.confidence === 'Low').length,
      Unknown: vehicleSnapshots.filter(v => v.confidence === 'Unknown').length,
    };

    const totalVehicles = vehicleSnapshots.length;
    const percentages = {
      High: totalVehicles > 0 ? Math.round((byConfidence.High / totalVehicles) * 100) : 0,
      Medium: totalVehicles > 0 ? Math.round((byConfidence.Medium / totalVehicles) * 100) : 0,
      Low: totalVehicles > 0 ? Math.round((byConfidence.Low / totalVehicles) * 100) : 0,
      Unknown: totalVehicles > 0 ? Math.round((byConfidence.Unknown / totalVehicles) * 100) : 0,
    };

    // Group by state
    const byState = {};
    filteredVehicles.forEach(v => {
      if (!byState[v.state]) {
        byState[v.state] = { High: 0, Medium: 0, Low: 0, Unknown: 0 };
      }
    });
    vehicleSnapshots.forEach(v => {
      if (byState[v.state]) {
        byState[v.state][v.confidence]++;
      }
    });

    // Group by depot
    const byDepot = {};
    filteredVehicles.forEach(v => {
      if (v.primary_depot && !byDepot[v.primary_depot]) {
        byDepot[v.primary_depot] = { High: 0, Medium: 0, Low: 0, Unknown: 0 };
      }
    });
    vehicleSnapshots.forEach(v => {
      if (v.primary_depot && byDepot[v.primary_depot]) {
        byDepot[v.primary_depot][v.confidence]++;
      }
    });

    // Group by function class
    const byFunctionClass = {};
    filteredVehicles.forEach(v => {
      if (!byFunctionClass[v.vehicle_function_class]) {
        byFunctionClass[v.vehicle_function_class] = { High: 0, Medium: 0, Low: 0, Unknown: 0 };
      }
    });
    vehicleSnapshots.forEach(v => {
      if (byFunctionClass[v.vehicle_function_class]) {
        byFunctionClass[v.vehicle_function_class][v.confidence]++;
      }
    });

    return Response.json({
      success: true,
      summary: {
        total_vehicles: totalVehicles,
        by_confidence: byConfidence,
        percentages: percentages,
        exceptions_count: exceptionsList.length,
      },
      by_state: byState,
      by_depot: byDepot,
      by_function_class: byFunctionClass,
      exceptions: exceptionsList.sort((a, b) => {
        // Sort by confidence (Low first) and exception count
        const confidenceOrder = { Low: 0, Medium: 1, Unknown: 2, High: 3 };
        const aConf = confidenceOrder[a.confidence] || 4;
        const bConf = confidenceOrder[b.confidence] || 4;
        if (aConf !== bConf) return aConf - bConf;
        return b.exception_types.length - a.exception_types.length;
      }),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Odometer data quality aggregates error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
});