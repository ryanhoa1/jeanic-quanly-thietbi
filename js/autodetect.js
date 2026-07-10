import { toast, openModal, closeModal } from './ui.js';
import { downloadFile } from './helpers.js';

// ---------------------------------------------------------------------------
// PART 1 — Quick single-machine scan, done entirely in the browser.
// Browsers deliberately do NOT expose real hardware identifiers (exact CPU
// model, exact RAM size, disk model, BIOS serial…) for privacy reasons, so
// this can only ever be a best-effort approximation of the CURRENT machine
// running the browser. It's handy for a quick fill-in while adding a single
// device, but it is not a substitute for a proper inventory scan.
// ---------------------------------------------------------------------------
async function detectBrowserConfig() {
  const nav = navigator;
  const uaData = nav.userAgentData;

  let osLabel = "Không xác định";
  try {
    if (uaData && uaData.getHighEntropyValues) {
      const hv = await uaData.getHighEntropyValues(["platformVersion", "architecture", "model"]);
      osLabel = `${uaData.platform || ""} ${hv.platformVersion || ""}`.trim();
    } else {
      osLabel = nav.platform || "";
    }
  } catch (e) { osLabel = nav.platform || ""; }

  const cores = nav.hardwareConcurrency || null;
  const ramGB = nav.deviceMemory || null; // Chrome-only, rounded, capped at 8

  let gpu = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "";
    }
  } catch (e) { /* ignore */ }

  let storageGB = null;
  try {
    if (nav.storage && nav.storage.estimate) {
      const est = await nav.storage.estimate();
      if (est && est.quota) storageGB = Math.round((est.quota / (1024 ** 3)) * 10) / 10;
    }
  } catch (e) { /* ignore */ }

  const resolution = `${screen.width}x${screen.height}`;

  return {
    cpu: cores ? `${cores} luồng xử lý (số nhân logic — không rõ tên chip cụ thể)${gpu ? " — GPU: " + gpu : ""}` : (gpu || ""),
    ram: ramGB ? `≈ ${ramGB} GB (trình duyệt chỉ báo gần đúng, tối đa 8GB)` : "",
    storage: storageGB ? `≈ ${storageGB} GB dung lượng khả dụng cho trình duyệt (không phải dung lượng ổ đĩa thật)` : "",
    os: osLabel || "",
    resolution,
    serial: "" // never available from a browser
  };
}

// Fill whatever inputs are currently shown in the open device form with the
// best-effort browser scan. Only touches empty attrs, and always appends a
// note to fSpecs rather than overwriting anything the user already typed.
export async function autoDetectDeviceConfig() {
  const typeEl = document.getElementById("fType");
  const specsEl = document.getElementById("fSpecs");
  if (!typeEl || !specsEl) return;

  toast("Đang quét cấu hình trình duyệt hiện tại…", "info");
  const detected = await detectBrowserConfig();

  // Map into whatever attr inputs exist for the currently selected category
  document.querySelectorAll('#fAttrsWrap .attr-input').forEach(inp => {
    const key = inp.dataset.attrKey;
    if (!key) return;
    if (inp.value.trim()) return; // don't clobber values the user already entered
    if (key === "cpu" && detected.cpu) inp.value = detected.cpu;
    if (key === "ram" && detected.ram) inp.value = detected.ram;
    if (key === "storage" && detected.storage) inp.value = detected.storage;
    if (key === "os" && detected.os) inp.value = detected.os;
    if (key === "resolution" && detected.resolution) inp.value = detected.resolution;
  });

  const summary = [
    detected.os && `HĐH: ${detected.os}`,
    detected.cpu && `CPU: ${detected.cpu}`,
    detected.ram && `RAM: ${detected.ram}`,
    `Độ phân giải màn hình: ${detected.resolution}`
  ].filter(Boolean).join(" | ");

  if (!specsEl.value.includes("[Quét tự động]")) {
    specsEl.value = specsEl.value ? `${specsEl.value}\n[Quét tự động] ${summary}` : `[Quét tự động] ${summary}`;
  }

  toast("Đã điền cấu hình ước tính — vui lòng kiểm tra lại trước khi lưu", "success");
}

// ---------------------------------------------------------------------------
// PART 2 — Accurate bulk scan via a downloadable PowerShell script.
// This is the real answer to "lấy cấu hình tự động thay vì thu thập bằng
// tay": IT chạy script này trên (nhiều) máy Windows, script đọc cấu hình
// thật qua WMI/CIM và xuất thẳng ra file CSV có ĐÚNG các cột & nhãn cột mà
// màn hình "Nhập thiết bị từ Excel" của hệ thống đang dùng — nên chỉ cần
// tải file đó lên và nhấn Nhập, không cần map lại tay.
// ---------------------------------------------------------------------------
const PS_SCRIPT = String.raw`<#
  JEANIC IT - Script quet cau hinh thiet bi tu dong
  ---------------------------------------------------
  Muc dich : Thu thap cau hinh may Windows (CPU, RAM, o dia, He dieu hanh,
             Serial, MAC, IP...) va xuat ra file CSV dung DINH DANG CỘT
             cua man hinh "Nhap thiet bi tu Excel" trong he thong quan ly
             tai san JEANIC IT, de nhap hang loat ma khong phai go tay.

  Cach dung:
    1) Copy file nay (.ps1) vao may can quet, hoac chia se qua mang noi bo.
    2) Mo PowerShell VOI QUYEN ADMINISTRATOR, chay:
         Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
         .\Quet-CauHinh-JeanicIT.ps1
    3) Script se tao file CauHinhThietBi-<TENMAY>-<ngay>.csv trong cung thu muc.
    4) De quet nhieu may cung luc (tuy chon, can PowerShell Remoting da bat -
       Enable-PSRemoting), sua bien $ComputerList ben duoi va chay lai; script
       se tao 1 dong CSV cho moi may, gop chung vao 1 file.
    5) Vao he thong -> Nghiep vu -> Bao cao & Kiem ke -> "2. Chon file da dien
       de nhap" -> chon file CSV vua tao. He thong tu doi chieu va cho xem
       truoc truoc khi nhap that.

  Luu y quan trong:
    - Trang thai mac dinh la "Trong kho" (khong gan nguoi dung) de nguoi
      duyet du lieu tu quyet dinh ban giao cho ai truoc khi nhap.
    - Thuong hieu/Loai thiet bi duoc doan tu thong tin may; hay kiem tra lai
      truoc khi nhap that, dac biet voi may lap rap (Manufacturer trong).
    - Script CHI DOC thong tin cau hinh, KHONG thay doi gi tren may duoc quet.
#>

param(
  # Them may khac vao day (ten may hoac IP) de quet tu xa qua PowerShell
  # Remoting. De trong = chi quet may dang chay script.
  [string[]]$ComputerList = @($env:COMPUTERNAME)
)

$ErrorActionPreference = "SilentlyContinue"

# Dung DUNG cac tieu de cot nhu file mau xuat tu he thong (import.js ->
# IMPORT_COLUMNS) de khong phai map lai thu cong.
$Headers = @(
  "Mã TB (để trống để tự sinh mã)",
  "Loại thiết bị (*)",
  "Thương hiệu (*)",
  "Thông số kỹ thuật",
  "Thông số chuyên biệt (key: value; key2: value2)",
  "Tình trạng (*)",
  "Trạng thái (*)",
  "Mã NV đang giữ (bắt buộc nếu Trạng thái = Đang sử dụng)",
  "Ngày nhập kho (yyyy-mm-dd)",
  "Ngày mua (yyyy-mm-dd)",
  "Giá mua (đồng)",
  "Nhà cung cấp",
  "Số hoá đơn",
  "Bảo hành (tháng)",
  "Vòng đời sử dụng (năm)",
  "Giá trị thanh lý ước tính (đồng)",
  "Ghi chú"
)

function Get-OneMachineConfig {
  param([string]$Computer)

  $cimParams = @{ ComputerName = $Computer; ErrorAction = "Stop" }

  try {
    $cs     = Get-CimInstance -ClassName Win32_ComputerSystem @cimParams
    $os     = Get-CimInstance -ClassName Win32_OperatingSystem @cimParams
    $cpu    = Get-CimInstance -ClassName Win32_Processor @cimParams | Select-Object -First 1
    $bios   = Get-CimInstance -ClassName Win32_BIOS @cimParams
    $disks  = Get-CimInstance -ClassName Win32_DiskDrive @cimParams
    $enc    = Get-CimInstance -ClassName Win32_SystemEnclosure @cimParams
    $nic    = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration @cimParams | Where-Object { $_.IPEnabled -eq $true } | Select-Object -First 1
  } catch {
    Write-Warning "Khong the quet may '$Computer': $($_.Exception.Message)"
    return $null
  }

  $ramGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)

  $diskInfo = ($disks | ForEach-Object {
    $sizeGB = [math]::Round($_.Size / 1GB, 0)
    "$($_.Model.Trim()) ($sizeGB GB)"
  }) -join " + "

  # Doan loai thiet bi tu ma ChassisTypes (8/9/10/14 = laptop cac loai)
  $laptopCodes = @(8,9,10,11,12,14,18,21,30,31,32)
  $chassis = $enc.ChassisTypes | Select-Object -First 1
  $isLaptop = $laptopCodes -contains $chassis
  $loaiThietBi = if ($isLaptop) { "Laptop" } else { "Desktop" }

  $manufacturer = $cs.Manufacturer.Trim()
  $model = $cs.Model.Trim()

  $specs = "$manufacturer $model, $($cpu.Name.Trim()), RAM $($ramGB)GB" + $(if ($diskInfo) { ", $diskInfo" } else { "" })

  $attrsParts = @(
    "cpu: $($cpu.Name.Trim())",
    "ram: $($ramGB)GB",
    $(if ($diskInfo) { "storage: $diskInfo" }),
    "os: $($os.Caption.Trim()) $($os.Version)",
    "serial: $($bios.SerialNumber.Trim())"
  ) | Where-Object { $_ }
  $attrsText = ($attrsParts -join "; ")

  $ghiChu = "Tu dong quet luc $(Get-Date -Format 'yyyy-MM-dd HH:mm') tren may '$Computer'" + $(if ($nic) { " - IP: $($nic.IPAddress[0]) - MAC: $($nic.MACAddress)" } else { "" })

  [PSCustomObject]@{
    "Mã TB (để trống để tự sinh mã)"                                     = ""
    "Loại thiết bị (*)"                                                  = $loaiThietBi
    "Thương hiệu (*)"                                                    = $manufacturer
    "Thông số kỹ thuật"                                                  = $specs
    "Thông số chuyên biệt (key: value; key2: value2)"                    = $attrsText
    "Tình trạng (*)"                                                     = "Tốt"
    "Trạng thái (*)"                                                     = "Trong kho"
    "Mã NV đang giữ (bắt buộc nếu Trạng thái = Đang sử dụng)"            = ""
    "Ngày nhập kho (yyyy-mm-dd)"                                         = (Get-Date -Format "yyyy-MM-dd")
    "Ngày mua (yyyy-mm-dd)"                                              = ""
    "Giá mua (đồng)"                                                     = ""
    "Nhà cung cấp"                                                       = ""
    "Số hoá đơn"                                                         = ""
    "Bảo hành (tháng)"                                                   = ""
    "Vòng đời sử dụng (năm)"                                             = ""
    "Giá trị thanh lý ước tính (đồng)"                                   = ""
    "Ghi chú"                                                            = $ghiChu
  }
}

$results = foreach ($c in $ComputerList) { Get-OneMachineConfig -Computer $c }
$results = $results | Where-Object { $_ -ne $null }

if (-not $results) {
  Write-Error "Khong quet duoc may nao. Kiem tra quyen Administrator / ket noi mang toi may can quet."
  exit 1
}

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$outFile = Join-Path -Path (Get-Location) -ChildPath "CauHinhThietBi-$stamp.csv"

# -UseCulture de Excel VN mo dung dau phay/cham; Encoding UTF8 de giu dau tieng Viet.
$results | Select-Object $Headers | Export-Csv -Path $outFile -NoTypeInformation -Encoding UTF8 -Delimiter ","

Write-Host ""
Write-Host "Da quet xong $($results.Count) may. File ket qua:" -ForegroundColor Green
Write-Host $outFile -ForegroundColor Yellow
Write-Host "Vao he thong JEANIC IT -> Nghiep vu -> Bao cao & Kiem ke -> muc Nhap tu Excel de tai file nay len." -ForegroundColor Green
`;

export function downloadAutoConfigScript() {
  downloadFile(PS_SCRIPT, "Quet-CauHinh-JeanicIT.ps1", "text/plain;charset=utf-8");
  toast("Đã tải script quét cấu hình (PowerShell)");
}

export function showAutoConfigInstructions() {
  const body = `
    <div style="font-size:13.5px; color:var(--text-secondary); line-height:1.7;">
      <p><b>1. Quét nhanh 1 máy (trong trình duyệt)</b><br>
      Khi thêm/sửa thiết bị, bấm nút <i>"Quét cấu hình máy đang dùng"</i> trong form. Chỉ điền được thông tin
      <b>ước tính</b> của máy đang mở trình duyệt (số nhân CPU, RAM gần đúng, độ phân giải…) — trình duyệt
      không được phép đọc Serial, tên CPU chính xác hay dung lượng ổ đĩa thật vì lý do bảo mật.</p>

      <p><b>2. Quét chính xác, hàng loạt (khuyến nghị dùng cho kiểm kê)</b><br>
      Tải script PowerShell ở nút bên cạnh, chạy trên từng máy Windows (hoặc quét từ xa nhiều máy cùng lúc nếu
      đã bật PowerShell Remoting). Script đọc cấu hình thật qua WMI: CPU, RAM, ổ cứng, hệ điều hành, Serial (BIOS),
      MAC, IP — và xuất ra file CSV với <b>đúng tên cột</b> mà màn hình nhập Excel của hệ thống đang dùng.</p>

      <p><b>3. Nhập vào hệ thống</b><br>
      Vào <i>Nghiệp vụ → Báo cáo & Kiểm kê → "2. Chọn file đã điền để nhập"</i> và chọn thẳng file CSV vừa tạo
      (hệ thống hiện đã hỗ trợ cả .xlsx và .csv). Hệ thống sẽ hiện bảng xem trước để kiểm tra trước khi nhập thật,
      trạng thái mặc định là "Trong kho" để bạn chủ động bàn giao sau.</p>
    </div>
  `;
  const foot = `<button class="btn btn-brand" onclick="app.closeModal()">Đã hiểu</button>`;
  openModal("Hướng dẫn quét cấu hình tự động", body, foot, "620px");
}
