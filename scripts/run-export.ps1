param(
  [string]$FunctionFile,
  [string]$Method = "POST",
  [string]$Body = "{}"
)

if (-not (Get-Command deno -ErrorAction SilentlyContinue)) {
  Write-Error "deno not found in PATH"
  exit 1
}

if (-not $env:EXPORT_ADMIN_TOKEN) {
  Write-Error "Set EXPORT_ADMIN_TOKEN environment variable"
  exit 1
}

$proc = Start-Process -FilePath "deno" -ArgumentList @("run","-A",$FunctionFile) -PassThru
Start-Sleep -Seconds 2

$headers = New-Object "System.Collections.Generic.Dictionary[String,String]"
$headers["Authorization"] = "Bearer " + $env:EXPORT_ADMIN_TOKEN

try {
  $response = Invoke-RestMethod -Uri "http://localhost:8000" -Method $Method -Headers $headers -Body $Body -ContentType "application/json"
  $response | ConvertTo-Json -Depth 6
} catch {
  $status = $null
  $body = $null
  if ($_.Exception -and $_.Exception.Response) {
    try {
      $status = $_.Exception.Response.StatusCode.value__
      $stream = $_.Exception.Response.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $body = $reader.ReadToEnd()
      $reader.Close()
    } catch {}
  }
  if ($status -ne $null -and $body -ne $null) {
    Write-Host "Request failed with status $status"
    Write-Output $body
  } else {
    Write-Error ($_.Exception.Message)
  }
  exit 1
} finally {
  if ($proc -and $proc.Id) {
    Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue
  }
}
