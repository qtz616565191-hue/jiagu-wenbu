# gen-from-file.ps1 - function library: read UTF-8 prompt file, call Seedream via arkcli
# Usage after iex: Invoke-GenFromFile -PromptFile <txt> -OutFile <png> [-Ratio 1:1]
function Invoke-GenFromFile {
  param(
      [Parameter(Mandatory=$true)][string]$PromptFile,
      [Parameter(Mandatory=$true)][string]$OutFile,
      [string]$Ratio = "1:1",
      [string]$Profile = "platform_cn-beijing_accountwide",
      [string]$Endpoint = "ep-20260920111848-wwq8h"
  )
  $ErrorActionPreference = "Stop"
  $Prompt = [System.IO.File]::ReadAllText($PromptFile, [System.Text.Encoding]::UTF8).Trim()

  $work = Join-Path $env:TEMP "arkgen-$([guid]::NewGuid().ToString('N').Substring(0,8))"
  New-Item -ItemType Directory -Path $work -Force | Out-Null

  $argList = @(
      "+gen","--profile",$Profile,
      "--model",$Endpoint,
      "--ratio",$Ratio,
      "--image-count","1",
      "--output-format","png",
      "--no-open",
      "--watermark=false",
      "--save-to",$work,
      $Prompt
  )
  Write-Host "Generating $OutFile ($Ratio) ..."
  & arkcli @argList
  if ($LASTEXITCODE -ne 0) { throw "gen failed for $OutFile" }

  $png = Get-ChildItem -Path $work -Filter *.png | Select-Object -First 1
  if (-not $png) { throw "no png for $OutFile" }
  Move-Item $png.FullName $OutFile -Force
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Saved: $OutFile"
}
