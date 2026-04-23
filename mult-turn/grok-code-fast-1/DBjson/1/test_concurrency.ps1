$token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3NjczNDg0OH0.ZGHumd49gKWdwTHulKW0KzL49d0RY5vn138bXIA_wYI'

$jobs = @()
for ($i = 1; $i -le 20; $i++) {
    $body = '{"name":"Product' + $i + '","price":' + (100 + $i) + '}'
    $jobs += Start-Job -ScriptBlock {
        param($url, $body, $token)
        Invoke-WebRequest -Uri $url -Method POST -Body $body -ContentType 'application/json' -Headers @{ "Authorization" = "Bearer $token" } -UseBasicParsing | Select-Object -ExpandProperty Content
    } -ArgumentList "http://localhost:3000/products", $body, $token
}

$results = $jobs | Wait-Job | Receive-Job
$results | ForEach-Object { Write-Host $_ }