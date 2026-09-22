# optimize-images.ps1 - resize + JPEG compress via System.Drawing (ASCII only)
# iex then: Optimize-Image -In img-src/hero.png -Out img/hero.jpg -MaxW 640
Add-Type -AssemblyName System.Drawing
function Optimize-Image {
  param(
    [Parameter(Mandatory=$true)][string]$In,
    [Parameter(Mandatory=$true)][string]$Out,
    [int]$MaxW = 720,
    [int]$Quality = 88
  )
  $src = [System.Drawing.Image]::FromFile((Resolve-Path $In).Path)
  $scale = [Math]::Min(1.0, $MaxW / $src.Width)
  $w = [int]($src.Width * $scale); $h = [int]($src.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($src, 0, 0, $w, $h)

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
  $bmp.Save((Join-Path (Get-Location) $Out), $codec, $ep)

  $g.Dispose(); $bmp.Dispose(); $src.Dispose()
  Write-Host "$Out ${w}x${h}"
}
