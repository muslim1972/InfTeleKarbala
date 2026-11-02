$docxPath = "F:\صور للتجربة\نظام المديرية\نظام الادارة\تطبيق نحن\فورمات التطبيق\كتب رسمية.docx"
$tempPath = "$env:TEMP\official_books_copy.docx"

# Copy with FileShare.ReadWrite
$srcStream = [System.IO.File]::Open($docxPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$dstStream = [System.IO.File]::Create($tempPath)
$srcStream.CopyTo($dstStream)
$srcStream.Close()
$dstStream.Close()

[System.Reflection.Assembly]::LoadWithPartialName("System.IO.Compression.FileSystem") | Out-Null
$zip = [System.IO.Compression.ZipFile]::OpenRead($tempPath)

foreach ($entry in $zip.Entries) {
    if ($entry.FullName -like "word/*.xml") {
        Write-Output "Entry: $($entry.FullName)"
        if ($entry.FullName -in @("word/document.xml", "word/header1.xml", "word/header2.xml", "word/footer1.xml", "word/footer2.xml", "word/footer3.xml")) {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            $text = [System.Text.RegularExpressions.Regex]::Replace($content, "<[^>]+>", " ")
            $text = [System.Text.RegularExpressions.Regex]::Replace($text, "\s+", " ").Trim()
            Write-Output "--- $($entry.FullName) ---"
            Write-Output $text
        }
    }
}

$zip.Dispose()
Remove-Item $tempPath -Force -ErrorAction SilentlyContinue
