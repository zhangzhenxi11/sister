[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$body = @{
    message = "什么是女性解码"
    useRag = $true
} | ConvertTo-Json -Compress

$response = Invoke-RestMethod -Uri "http://localhost:3001/api/learn/persona/6a211425-02ae-4e9e-bd14-a1f3b7d0c169/chat" -Method POST -Body $body -ContentType "application/json; charset=utf-8"

$response | ConvertTo-Json -Depth 10
