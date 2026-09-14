# GT3 Sistema - Reinicio diario do servidor (next dev)
# Rodando em modo de desenvolvimento (hot reload para facilitar as mudancas feitas com o
# Claude Code), o processo acumula memoria com o uso continuo ao longo dos dias, deixando
# o site mais lento e, em casos extremos, causando instabilidade no login. Este script
# encerra o processo atual na porta 3000 e sobe um novo, limpo, todo santo dia.
# Agendado via Task Scheduler (tarefa "GT3Sistema-RestartDev").

$ErrorActionPreference = 'SilentlyContinue'
$projectDir = 'C:\Users\rodri\gt3-sistema'
$logDir = Join-Path $projectDir 'logs'
$logFile = Join-Path $logDir 'next-dev.log'
$errFile = Join-Path $logDir 'next-dev.err.log'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Encerra quem estiver ouvindo a porta 3000 (o servidor next dev atual, se existir)
$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3

# Log do dia anterior vira .old (mantem so 1 historico, evita crescer sem limite)
if (Test-Path $logFile) { Move-Item -Force $logFile "$logFile.old" }
if (Test-Path $errFile) { Move-Item -Force $errFile "$errFile.old" }

Start-Process -FilePath 'C:\Program Files\nodejs\npx.cmd' -ArgumentList 'next dev' `
    -WorkingDirectory $projectDir -WindowStyle Hidden `
    -RedirectStandardOutput $logFile -RedirectStandardError $errFile
