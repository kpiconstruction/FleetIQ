if (-not $env:EXPORT_ADMIN_TOKEN) {
  Write-Error "Set EXPORT_ADMIN_TOKEN env var"
  exit 1
}

& $PSScriptRoot/run-export.ps1 "functions/exportVehiclesForTrae.ts" "POST" '{"offset":0,"limit":10}'
& $PSScriptRoot/run-export.ps1 "functions/exportMaintenanceDataForTrae.ts" "POST" '{"entityType":"templates","offset":0,"limit":10}'
& $PSScriptRoot/run-export.ps1 "functions/exportMaintenanceDataForTrae.ts" "POST" '{"entityType":"plans","offset":0,"limit":10}'
& $PSScriptRoot/run-export.ps1 "functions/exportMaintenanceDataForTrae.ts" "POST" '{"entityType":"workOrders","offset":0,"limit":10}'
& $PSScriptRoot/run-export.ps1 "functions/exportMaintenanceDataForTrae.ts" "POST" '{"entityType":"serviceRecords","offset":0,"limit":10}'
& $PSScriptRoot/run-export.ps1 "functions/exportOperationalDataForTrae.ts" "POST" '{"entityType":"usage","offset":0,"limit":10}'
& $PSScriptRoot/run-export.ps1 "functions/exportOperationalDataForTrae.ts" "POST" '{"entityType":"defects","offset":0,"limit":10}'
& $PSScriptRoot/run-export.ps1 "functions/exportOperationalDataForTrae.ts" "POST" '{"entityType":"incidents","offset":0,"limit":10}'
& $PSScriptRoot/run-export.ps1 "functions/exportOperationalDataForTrae.ts" "POST" '{"entityType":"fuelTransactions","offset":0,"limit":10}'
& $PSScriptRoot/run-export.ps1 "functions/exportWorkerRiskDataForTrae.ts" "POST" '{"offset":0,"limit":10}'
