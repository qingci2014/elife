@echo off
setlocal
cd /d "%~dp0"

set "NPM=D:\Program Files\nodejs\npm.cmd"
set "GIT=C:\Program Files\Git\cmd\git.exe"

if not exist "%NPM%" (
  echo [ERROR] npm was not found at: %NPM%
  exit /b 1
)

if not exist "%GIT%" (
  echo [ERROR] Git was not found at: %GIT%
  exit /b 1
)

echo [1/3] Testing the website...
call "%NPM%" test
if errorlevel 1 exit /b 1

echo [2/3] Checking the working tree...
for /f "delims=" %%I in ('"%GIT%" status --porcelain') do (
  echo [ERROR] Uncommitted changes were found.
  echo Commit the intended files before publishing.
  "%GIT%" status --short
  exit /b 1
)

echo [3/3] Pushing main to GitHub...
"%GIT%" -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push origin main
if errorlevel 1 exit /b 1

echo.
echo Push complete. EdgeOne will build the new commit automatically.
endlocal
