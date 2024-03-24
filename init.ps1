function Get-CompressedFileName {
    return "yolm_windows_amd.gz"
}

function Get-YolmDir {
    return Join-Path $HOME ".yolm\bin"
}

function Get-YolmPath {
    return Join-Path (Get-YolmDir) ("yolm.exe")
}

function Get-DownloadedPath {
    return Join-Path $HOME ".yolm\bin\yolm_downloaded"
}

function Ensure-LatestYolmExecutable {
    $yolmPath = Get-YolmPath
    $yolmDir = Get-YolmDir
    if (-not (Test-Path $yolmDir)) {
        New-Item -ItemType Directory -Path $yolmDir -Force
    }

    if (-not (Test-Path $yolmPath)) {
        Download-LatestYolm
    } else {
        $proc = Start-Process -FilePath $yolmPath -ArgumentList "upgrade" -PassThru -Wait
        if ($proc.ExitCode -ne 0) {
            exit 1
        }
        $downloadedPath = Get-DownloadedPath
        if (Test-Path $downloadedPath) {
            Copy-Item -Path $downloadedPath -Destination $yolmPath -Force
            Remove-Item -Path $downloadedPath
        }
    }
}

function Download-LatestYolm {
    $fileUrl = "https://yolmcli.com/" + (Get-CompressedFileName)
    $yolmPath = Get-YolmPath
    $yolmGzPath = "$yolmPath.gz"

    Invoke-WebRequest -Uri $fileUrl -OutFile $yolmGzPath

    # Decompress the .gz file
    $fileStream = [System.IO.File]::OpenRead($yolmGzPath)
    $decompressedStream = New-Object System.IO.FileStream $yolmPath, 'Create'
    $gzipStream = New-Object System.IO.Compression.GZipStream $fileStream, [System.IO.Compression.CompressionMode]::Decompress
    $gzipStream.CopyTo($decompressedStream)
    $gzipStream.Dispose()
    $decompressedStream.Dispose()
    $fileStream.Dispose()

    Remove-Item -Path $yolmGzPath
    Write-Host "Yolm development executable successfully installed."
}

function Run-InitCommand {
    $yolmPath = Get-YolmPath
    $proc = Start-Process -FilePath $yolmPath -ArgumentList "init" -PassThru -Wait
    if ($proc.ExitCode -ne 0) {
        exit 1
    }
}

# Init System
Ensure-LatestYolmExecutable
Run-InitCommand