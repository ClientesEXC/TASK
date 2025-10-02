@echo off
REM =====================================================
REM FIX PRODUCCION DB (Docker) - Robusto
REM Ubicacion: task-manager\backend
REM =====================================================

setlocal ENABLEDELAYEDEXPANSION
chcp 65001 >nul

echo ========================================
echo   FIX PRODUCCION DB (Docker)
echo ========================================
echo.

REM === 1) Nombre base del contenedor (ajusta si hace falta) ===
set "DB_CONTAINER=task-db"

REM === 2) Mostrar contenedores activos para ayudarte a ver el nombre real ===
echo [Info] Contenedores activos:
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
echo.

REM === 3) Intentar match EXACTO ===
set "FOUND="
for /f "tokens=*" %%A in ('docker ps --format "{{.Names}}"') do (
  if /I "%%A"=="%DB_CONTAINER%" set "FOUND=%%A"
)

REM === 4) Si no hay exacto, intentar COINCIDENCIA PARCIAL (primer match) ===
if "%FOUND%"=="" (
  echo [Aviso] No se encontro match EXACTO con "%DB_CONTAINER%". Intentando coincidencia parcial...
  for /f "tokens=*" %%A in ('docker ps --format "{{.Names}}" ^| findstr /I "%DB_CONTAINER%"') do (
    set "FOUND=%%A"
    goto :found
  )
)

:found
if "%FOUND%"=="" (
  echo.
  echo ERROR: No se encontro ningun contenedor que coincida con "%DB_CONTAINER%".
  echo Tip: Mira la columna "NAMES" arriba y usa ese nombre exacto.
  echo      Por ejemplo: "task-manager-task-db-1"
  echo Luego edita esta linea en el .bat:  set "DB_CONTAINER=EL_NOMBRE_REAL"
  exit /b 1
)

set "DB_CONTAINER=%FOUND%"
echo [OK] Usando contenedor: %DB_CONTAINER%
echo.

REM === 5) Leer usuario y base reales desde el contenedor ===
for /f "usebackq tokens=*" %%A in (`docker exec %DB_CONTAINER% printenv POSTGRES_USER`) do set "PGUSER=%%A"
for /f "usebackq tokens=*" %%A in (`docker exec %DB_CONTAINER% printenv POSTGRES_DB`) do set "PGDB=%%A"

if "%PGUSER%"=="" (
  echo ERROR: No pude leer POSTGRES_USER/POSTGRES_DB desde %DB_CONTAINER%.
  echo Verifica que las variables existen en el contenedor.
  exit /b 1
)

echo [OK] Usuario DB: %PGUSER% ^| Base: %PGDB%
echo.

REM === 6) Función para aplicar un archivo .sql si existe ===
call :RunSQL "db\fix_database_production_v2.sql"
call :RunSQL "db\fix_roles_constraint_patch_v2.sql"

REM === 7) Verificaciones rapidas ===
echo.
echo [Verificacion] Estado de tasks.created_by:
docker exec -i %DB_CONTAINER% psql -U %PGUSER% -d %PGDB% -c "SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='created_by';"

echo.
echo [Verificacion] Usuario sistema (id=1):
docker exec -i %DB_CONTAINER% psql -U %PGUSER% -d %PGDB% -c "SELECT id,email,name,role FROM users WHERE id=1;"

REM === 8) (Opcional) Liberar puerto 3001 en Windows si hay proceso escuchando ===
echo.
echo [Opcional] Intentando liberar puerto 3001 en Windows...
for /f "tokens=5" %%P in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
  echo Deteniendo PID %%P ...
  taskkill /F /PID %%P >nul 2>&1
)

echo.
echo ========================================
echo   CORRECCION COMPLETADA
echo ========================================
echo.
echo Si las verificaciones se ven correctas, corre: npm run dev
echo.
exit /b 0

:RunSQL
set "FILE=%~1"
if not exist %FILE% (
  echo ⚠ No existe el archivo %FILE% (omitido)
  goto :eof
)
for %%F in (%FILE%) do set "BASE=%%~nxF"
set "REMOTE=/tmp/%BASE%"

echo -> Aplicando: %FILE%
docker cp %FILE% %DB_CONTAINER%:%REMOTE%
if errorlevel 1 (
  echo ERROR al copiar %FILE% al contenedor.
  exit /b 1
)

docker exec -i %DB_CONTAINER% psql -U %PGUSER% -d %PGDB% -f %REMOTE%
if errorlevel 1 (
  echo ERROR al ejecutar %FILE% dentro del contenedor.
  exit /b 1
)
echo.
goto :eof
