/**
 * Odometer Snapshot Service
 * 
 * Provides best-effort odometer reading for a vehicle using prestart data as primary source.
 * Includes sanity checks and confidence scoring.
 */

/**
 * Get the best available odometer reading for a vehicle
 * 
 * @param {Object} base44 - Base44 client instance
 * @param {string} vehicleId - Vehicle ID
 * @returns {Promise<{odometer_km: number|null, source: string, confidence: string, last_reading_datetime: string|null}>}
 */
export async function getBestOdometerSnapshot(base44, vehicleId) {
  try {
    // Fetch vehicle
    const vehicles = await base44.asServiceRole.entities.Vehicle.filter({ id: vehicleId });
    const vehicle = vehicles[0];
    if (!vehicle) {
      return {
        odometer_km: null,
        source: "Unknown",
        confidence: "Unknown",
        last_reading_datetime: null,
      };
    }

    // Fetch latest prestart with odometer reading
    const prestarts = await base44.asServiceRole.entities.PrestartCheck.filter(
      { vehicle_id: vehicleId },
      "-prestart_datetime",
      10
    );
    const latestPrestartWithOdo = prestarts.find(p => p.odometer_km && p.odometer_km > 0);

    // If no prestart data, fall back to vehicle field
    if (!latestPrestartWithOdo) {
      return {
        odometer_km: vehicle.current_odometer_km || null,
        source: "VehicleField",
        confidence: vehicle.odometer_data_confidence || "Unknown",
        last_reading_datetime: null,
      };
    }

    // Use prestart as primary source
    let odometerKm = latestPrestartWithOdo.odometer_km;
    let confidence = latestPrestartWithOdo.odometer_confidence || "Unknown";
    const lastReadingDatetime = latestPrestartWithOdo.prestart_datetime;

    // Sanity checks
    const previousOdo = vehicle.odometer_last_prestart_km || vehicle.current_odometer_km;
    if (previousOdo && previousOdo > 0) {
      const odometerDiff = odometerKm - previousOdo;
      
      // Check for backwards movement
      if (odometerDiff < 0) {
        console.warn(`Vehicle ${vehicle.asset_code}: Odometer went backwards from ${previousOdo} to ${odometerKm}`);
        confidence = "Low";
      }

      // Check for extreme jump (>2000 km in 24 hours)
      if (vehicle.odometer_last_prestart_datetime) {
        const previousDate = new Date(vehicle.odometer_last_prestart_datetime);
        const currentDate = new Date(latestPrestartWithOdo.prestart_datetime);
        const hoursDiff = (currentDate - previousDate) / (1000 * 60 * 60);
        
        if (hoursDiff > 0 && hoursDiff < 24 && odometerDiff > 2000) {
          console.warn(`Vehicle ${vehicle.asset_code}: Odometer jumped ${odometerDiff} km in ${hoursDiff.toFixed(1)} hours`);
          confidence = "Low";
          
          // If vehicle.current_odometer_km looks more reasonable, suggest fallback
          if (vehicle.current_odometer_km && Math.abs(vehicle.current_odometer_km - previousOdo) < 2000) {
            console.info(`Vehicle ${vehicle.asset_code}: Falling back to vehicle field odometer`);
            odometerKm = vehicle.current_odometer_km;
            return {
              odometer_km: odometerKm,
              source: "VehicleField",
              confidence: "Medium",
              last_reading_datetime: null,
            };
          }
        }
      }
    }

    return {
      odometer_km: odometerKm,
      source: "Prestart",
      confidence,
      last_reading_datetime: lastReadingDatetime,
    };
  } catch (error) {
    console.error(`Error getting odometer snapshot for vehicle ${vehicleId}:`, error);
    return {
      odometer_km: null,
      source: "Unknown",
      confidence: "Unknown",
      last_reading_datetime: null,
    };
  }
}

/**
 * Update vehicle odometer fields from latest prestart
 * Call this when a new prestart is created
 * 
 * @param {Object} base44 - Base44 client instance
 * @param {string} vehicleId - Vehicle ID
 * @param {number} odometerKm - Odometer reading from prestart
 * @param {string} prestartDatetime - Prestart datetime
 * @param {string} confidence - Confidence level
 */
export async function updateVehicleOdometerFromPrestart(base44, vehicleId, odometerKm, prestartDatetime, confidence = "Unknown") {
  try {
    await base44.asServiceRole.entities.Vehicle.update(vehicleId, {
      odometer_last_prestart_km: odometerKm,
      odometer_last_prestart_datetime: prestartDatetime,
      odometer_data_confidence: confidence,
      current_odometer_km: odometerKm, // Also update current_odometer_km for backwards compatibility
    });
  } catch (error) {
    console.error(`Error updating vehicle odometer from prestart:`, error);
  }
}