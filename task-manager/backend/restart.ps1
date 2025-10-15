# restart.ps1 - Reinicio completo del backend
Write-Host "🔄 Reiniciando backend..." -ForegroundColor Cyan

# 1. Obtener IP actual
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*"}).IPAddress
Write-Host "📡 IP detectada: $ip" -ForegroundColor Yellow

# 2. Actualizar .env con IP actual
$envContent = Get-Content .env -Raw
$envContent = $envContent -replace 'LOCAL_IP=.*', "LOCAL_IP=$ip"
$envContent = $envContent -replace 'FRONTEND_URL=http://[^:]+:', "FRONTEND_URL=http://${ip}:"
Set-Content .env $envContent
Write-Host "✅ .env actualizado con IP: $ip" -ForegroundColor Green

# 3. Matar proceso en puerto 3001
$port = 3001
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($connections) {
    $process = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        Write-Host "🔴 Matando proceso PID: $process" -ForegroundColor Red
        Stop-Process -Id $process -Force
        Start-Sleep -Seconds 3
    }
}

# 4. Iniciar servidor
Write-Host "🚀 Iniciando servidor en http://${ip}:3001" -ForegroundColor Green
npm start