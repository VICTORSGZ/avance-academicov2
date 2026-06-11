$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$excelPath = Join-Path $root "data\malla_base.xlsx"
$outPath = Join-Path $root "data\malla_base.js"

if (!(Test-Path $excelPath)) {
  throw "No se encontró el archivo Excel: $excelPath"
}

function Normalize-Header($value) {
  return ([string]$value).Trim().ToLower().Replace("á","a").Replace("é","e").Replace("í","i").Replace("ó","o").Replace("ú","u")
}

function Get-CellText($sheet, $row, $col) {
  $value = $sheet.Cells.Item($row, $col).Text
  if ($null -eq $value) { return "" }
  return ([string]$value).Trim()
}

$excel = $null
$workbook = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $workbook = $excel.Workbooks.Open($excelPath)

  $sheet = $null
  foreach ($ws in $workbook.Worksheets) {
    if ($ws.Name -eq "Malla") { $sheet = $ws; break }
  }
  if ($null -eq $sheet) { $sheet = $workbook.Worksheets.Item(1) }

  $used = $sheet.UsedRange
  $rowCount = $used.Rows.Count
  $colCount = $used.Columns.Count

  $headers = @{}
  for ($c = 1; $c -le $colCount; $c++) {
    $header = Normalize-Header (Get-CellText $sheet 1 $c)
    if ($header -ne "") { $headers[$header] = $c }
  }

  $required = @("codigo","nombre","semestre","creditos","area","periodicidad","prerequisitos","estadoinicial")
  foreach ($h in $required) {
    if (-not $headers.ContainsKey($h)) {
      throw "Falta la columna obligatoria '$h' en la hoja Malla. Columnas esperadas: Codigo, Nombre, Semestre, Creditos, Area, Periodicidad, Prerequisitos, EstadoInicial"
    }
  }

  $items = @()
  for ($r = 2; $r -le $rowCount; $r++) {
    $codigo = Get-CellText $sheet $r $headers["codigo"]
    $nombre = Get-CellText $sheet $r $headers["nombre"]
    if ($codigo -eq "" -and $nombre -eq "") { continue }

    $semestreText = Get-CellText $sheet $r $headers["semestre"]
    $creditosText = Get-CellText $sheet $r $headers["creditos"]
    [int]$semestre = 1
    [int]$creditos = 0
    [void][int]::TryParse($semestreText, [ref]$semestre)
    [void][int]::TryParse($creditosText, [ref]$creditos)

    $prText = Get-CellText $sheet $r $headers["prerequisitos"]
    $prereq = @()
    if ($prText -ne "") {
      $prereq = $prText -split "[,;|]" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    }

    $estado = (Get-CellText $sheet $r $headers["estadoinicial"]).ToLower()
    if ($estado -eq "") { $estado = "pendiente" }

    $items += [PSCustomObject]@{
      codigo = $codigo
      nombre = $nombre
      semestre = $semestre
      creditos = $creditos
      area = Get-CellText $sheet $r $headers["area"]
      periodicidad = Get-CellText $sheet $r $headers["periodicidad"]
      prerequisitos = @($prereq)
      estadoInicial = $estado
    }
  }

  $json = $items | ConvertTo-Json -Depth 8
  $content = @"
// Archivo generado automáticamente desde data/malla_base.xlsx.
// Edita el Excel y ejecuta convertir_excel.bat para actualizar esta malla.
window.MALLA_BASE = $json;
"@

  Set-Content -Path $outPath -Value $content -Encoding UTF8
  Write-Host "OK: se generó data\malla_base.js con $($items.Count) asignaturas." -ForegroundColor Green
  Write-Host "Ahora abre index.html o refresca el navegador." -ForegroundColor Cyan
}
catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Verifica que Microsoft Excel esté instalado y que data\malla_base.xlsx no esté dañado." -ForegroundColor Yellow
  exit 1
}
finally {
  if ($workbook -ne $null) { $workbook.Close($false) | Out-Null }
  if ($excel -ne $null) { $excel.Quit() | Out-Null }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
