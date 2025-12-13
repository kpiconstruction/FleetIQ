if (-not $env:DB_HOST -or -not $env:DB_PORT -or -not $env:DB_NAME -or -not $env:DB_USER -or -not $env:DB_PASSWORD) {
  Write-Error "Set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD"
  exit 1
}

deno run -A functions/services/runMigrations.ts
