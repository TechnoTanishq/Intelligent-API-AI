$base = "http://127.0.0.1:8000"

$cases = @(
  @{ name = "NORMAL"; scenario = "normal";
     body = '{"event_id":"evt-n1","timestamp":"2026-10-26T10:00:00Z","method":"GET","path":"/api/products","query":"category=books&page=2","headers":{"user-agent":"IntelliAPI-AI-Simulator/1.0"},"body":"","scenario_label":"normal"}' },
  @{ name = "SQLi"; scenario = "sqli";
     body = '{"event_id":"evt-s1","timestamp":"2026-10-26T10:00:05Z","method":"GET","path":"/api/login","query":"username=admin&password=wd%27%20OR%20%271%27%3D%271","headers":{"user-agent":"IntelliAPI-AI-Simulator/1.0"},"body":"","scenario_label":"sqli"}' },
  @{ name = "XSS"; scenario = "xss";
     body = '{"event_id":"evt-x1","timestamp":"2026-10-26T10:00:10Z","method":"POST","path":"/api/feedback","query":"","headers":{"user-agent":"IntelliAPI-AI-Simulator/1.0"},"body":"msg=%3Cscript%3Ealert(1)%3C%2Fscript%3E","scenario_label":"xss"}' },
  @{ name = "PATH"; scenario = "path_traversal";
     body = '{"event_id":"evt-p1","timestamp":"2026-10-26T10:00:15Z","method":"GET","path":"/api/files","query":"name=..%2F..%2F..%2Fetc%2Fpasswd","headers":{"user-agent":"IntelliAPI-AI-Simulator/1.0"},"body":"","scenario_label":"path_traversal"}' }
)

foreach ($c in $cases) {
  try {
    $resp = Invoke-WebRequest -Uri "$base/analyze" -Method Post -ContentType "application/json" -Body $c.body -UseBasicParsing
    $j = $resp.Content | ConvertFrom-Json
    Write-Host ""
    Write-Host "=== $($c.name) (scenario=$($c.scenario)) ==="
    Write-Host ("prediction    : {0}" -f $j.prediction)
    Write-Host ("attack_prob   : {0}" -f $j.attack_probability)
    Write-Host ("attack_type   : {0}" -f $j.attack_type)
    Write-Host ("risk_level    : {0}" -f $j.risk_level)
    Write-Host ("decision      : {0}" -f $j.decision)
    Write-Host ("latency_ms    : {0}" -f $j.inference_latency_ms)
    Write-Host ("heuristic_cnt : {0}" -f $j.heuristic_findings.Count)
    Write-Host ("ground_truth  : {0}" -f $c.scenario)
    $agree = if ($j.prediction -eq "ATTACK" -and $c.scenario -ne "normal") { "MATCH" }
             elseif ($j.prediction -eq "NORMAL" -and $c.scenario -eq "normal") { "MATCH" } else { "MISMATCH" }
    Write-Host ("model vs gt   : {0}" -f $agree)
    Write-Host ("policy        : {0}" -f $j.decision_policy)
  } catch {
    Write-Host "ERROR for $($c.name): $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "=== /health ==="
(Invoke-WebRequest -Uri "$base/health" -UseBasicParsing).Content
Write-Host ""
Write-Host "=== /stats ==="
(Invoke-WebRequest -Uri "$base/stats" -UseBasicParsing).Content
