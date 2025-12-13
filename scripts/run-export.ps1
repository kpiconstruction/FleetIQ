param(
  [string]$FunctionFile,
  [string]$Method = "POST",
  [string]$Body = "{}"
)

if (-not (Get-Command deno -ErrorAction SilentlyContinue)) {
  Write-Error "deno not found in PATH"
  exit 1
}

$proc = Start-Process -FilePath "deno" -ArgumentList @("run","-A",$FunctionFile) -PassThru
Start-Sleep -Seconds 2

$headers = New-Object "System.Collections.Generic.Dictionary[String,String]"
$headers["Authorization"] = "Bearer " + $env:BASE44_TOKEN
$headers["x-base44-app-id"] = $env:BASE44_APP_ID
$headers["x-base44-server-url"] = $env:BASE44_SERVER_URL
$headers["x-functions-version"] = $env:VITE_BASE44_FUNCTIONS_VERSION

$response = Invoke-RestMethod -Uri "http://localhost:8000" -Method $Method -Headers $headers -Body $Body -ContentType "application/json"

Stop-Process -Id $proc.Id

$response | ConvertTo-Json -Depth 6
