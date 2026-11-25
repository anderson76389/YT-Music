# Local, read-only measurement. No admin rights, no uploads, no account data.
param(
  [ValidateRange(1, 1440)][int]$Minutes = 10,
  [ValidateRange(1, 60)][int]$IntervalSeconds = 5,
  [string]$Output = (Join-Path (Get-Location) ('ytmusic-perf-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.csv'))
)
$ErrorActionPreference = 'Stop'
$logicalCpus = [Environment]::ProcessorCount
$previous = @{}
$clock = [System.Diagnostics.Stopwatch]::StartNew()
$last = $clock.Elapsed.TotalSeconds
$deadline = $Minutes * 60
Write-Host "Recording YT Music process CPU and RAM for $Minutes minute(s). Ctrl+C stops the test. Report: $Output"
while ($clock.Elapsed.TotalSeconds -lt $deadline) {
  $processes = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -match '^YT[- ]?Music(?:-Portable-Windows-x64)?$'
  })
  $now = $clock.Elapsed.TotalSeconds
  $delta = $now - $last
  $next = @{}
  $cpuDelta = 0.0
  foreach ($p in $processes) {
    try {
      $key = "$($p.Id):$($p.StartTime.Ticks)"
      $cpu = [double]$p.CPU
      $next[$key] = $cpu
      if ($previous.ContainsKey($key)) {
        $cpuDelta += [Math]::Max(0, $cpu - $previous[$key])
      }
    } catch { }
  }
  $working = ($processes | Measure-Object -Property WorkingSet64 -Sum).Sum
  $private = ($processes | Measure-Object -Property PrivateMemorySize64 -Sum).Sum
  $cpuPercent = if ($delta -gt 0 -and $previous.Count -gt 0) {
    [Math]::Round(100 * $cpuDelta / ($delta * $logicalCpus), 2)
  } else { $null }
  $row = [pscustomobject]@{
    timestamp = (Get-Date).ToString('o')
    elapsed_s = [Math]::Round($now, 2)
    processes = $processes.Count
    cpu_percent_total_machine = $cpuPercent
    working_set_mib = [Math]::Round($working / 1MB, 1)
    private_mib = [Math]::Round($private / 1MB, 1)
  }
  $row | Export-Csv -LiteralPath $Output -NoTypeInformation -Append -Encoding UTF8
  $row | Format-Table -AutoSize
  $previous = $next
  $last = $now
  Start-Sleep -Seconds $IntervalSeconds
}
