$token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3NjczNDg0OH0.ZGHumd49gKWdwTHulKW0KzL49d0RY5vn138bXIA_wYI'

$tasks = @()
for ($i = 1; $i -le 20; $i++) {
    $payload = '{"name":"Product' + $i + '","price":' + (100 + $i) + '}'
    $tasks += Start-Job -ScriptBlock {
        param($url, $payload, $token)
        Invoke-WebRequest -Uri $url -Method POST -Body $payload -ContentType 'application/json' -Headers @{ "Authorization" = "Bearer $token" } -UseBasicParsing | Select-Object -ExpandProperty Content
    } -ArgumentList "http://localhost:3000/products", $payload, $token
}

$outputs = $tasks | Wait-Job | Receive-Job
$outputs | ForEach-Object { Write-Host $_ }
