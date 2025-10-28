@echo off
echo 🚀 Iniciando Sistema WebSocket Automaticamente...
echo.

echo 1. Verificando e corrigindo problemas...
call npm run fix:webhook
echo.

echo 2. Configurando e iniciando sistema...
call npm run setup:webhook

pause