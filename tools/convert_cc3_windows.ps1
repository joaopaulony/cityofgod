# Local conversion; requires Blender 4.x and a copy of City of God on disk.
# Example: powershell -ExecutionPolicy Bypass -File tools/convert_cc3_windows.ps1
param(
 [string]$FemaleZip="$env:USERPROFILE\Downloads\Blender female.zip",
 [string]$MaleZip="$env:USERPROFILE\Downloads\Blender Male.zip"
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dir=Join-Path $env:ProgramFiles 'Blender Foundation'
$exe=Get-ChildItem -Path $dir -Recurse -Filter blender.exe -ErrorAction SilentlyContinue |
 Sort-Object FullName -Descending | Select-Object -First 1
if(-not $exe) { throw 'Blender nao encontrado. Instale Blender 4.x antes de executar.' }
if(!(Test-Path $FemaleZip)) { throw "ZIP feminino nao encontrado: $FemaleZip" }
if(!(Test-Path $MaleZip)) { throw "ZIP masculino nao encontrado: $MaleZip" }
$out=Join-Path $root 'assets\characters\cc3'
New-Item -ItemType Directory -Path $out -Force | Out-Null
Write-Host "Usando Blender: $($exe.FullName)"
Write-Host "Saida: $out"
& $exe.FullName -b --python (Join-Path $PSScriptRoot 'convert_cc3_bodies.py') -- --female-zip $FemaleZip --male-zip $MaleZip --out $out
if($LASTEXITCODE -ne 0) { throw "Blender falhou com codigo $LASTEXITCODE" }
Write-Host 'Conversao concluida. Confira a licenca dos modelos antes de distribuir.'
Write-Host 'Para visualizar LOCALMENTE, execute npm start e abra ?characters=cc3.'
