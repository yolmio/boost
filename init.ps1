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

function Update-LatestYolmVersion {
    $yolmPath = Get-YolmPath
    $yolmDir = Get-YolmDir
    if (-not (Test-Path $yolmDir)) {
        New-Item -ItemType Directory -Path $yolmDir -Force
    }

    if (-not (Test-Path $yolmPath)) {
        Add-Yolm
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

Function Decompress-GZip-File{
    Param(
        $infile,
        $outfile = ($infile -replace '\.gz$','')
        )

    $inputData = New-Object System.IO.FileStream $inFile, ([IO.FileMode]::Open), ([IO.FileAccess]::Read), ([IO.FileShare]::Read)
    $output = New-Object System.IO.FileStream $outFile, ([IO.FileMode]::Create), ([IO.FileAccess]::Write), ([IO.FileShare]::None)
    $gzipStream = New-Object System.IO.Compression.GzipStream $inputData, ([IO.Compression.CompressionMode]::Decompress)

    $buffer = New-Object byte[](1024)
    while($true){
        $read = $gzipstream.Read($buffer, 0, 1024)
        if ($read -le 0){break}
        $output.Write($buffer, 0, $read)
        }

    $gzipStream.Close()
    $output.Close()
    $inputData.Close()
}

function Add-Yolm {
    $fileUrl = "https://yolmcli.com/" + (Get-CompressedFileName)
    $yolmPath = Get-YolmPath
    $yolmGzPath = "$yolmPath.gz"

    Invoke-WebRequest -Uri $fileUrl -OutFile $yolmGzPath
    Decompress-GZip-File $yolmGzPath $yolmPath
    Remove-Item -Path $yolmGzPath
    
    Write-Host "Yolm development executable successfully installed."
}

function Add-System {
    $yolmPath = Get-YolmPath
    $arguments = "init"
    $command = "$yolmPath $arguments"
    Invoke-Expression $command
    if ($LASTEXITCODE -ne 0) {
        exit 1
    }
}


# Init System
Update-LatestYolmVersion
Add-System
