$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\', '/')
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8080/')

$contentTypes = @{
    '.css' = 'text/css; charset=utf-8'
    '.html' = 'text/html; charset=utf-8'
    '.js' = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg' = 'image/svg+xml'
}

try {
    $listener.Start()
    Write-Output 'Serving MHG on http://localhost:8080/'

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
            if ([string]::IsNullOrWhiteSpace($relativePath)) {
                $relativePath = 'index.html'
            }

            $relativePath = $relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relativePath))
            $rootPrefix = $root + [System.IO.Path]::DirectorySeparatorChar

            if (-not $filePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or
                -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                $context.Response.StatusCode = 404
                $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
            } else {
                $body = [System.IO.File]::ReadAllBytes($filePath)
                $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
                if ($contentTypes.ContainsKey($extension)) {
                    $context.Response.ContentType = $contentTypes[$extension]
                } else {
                    $context.Response.ContentType = 'application/octet-stream'
                }
                $context.Response.StatusCode = 200
            }

            $context.Response.ContentLength64 = $body.Length
            $context.Response.OutputStream.Write($body, 0, $body.Length)
        } catch {
            Write-Error "Request failed: $($_.Exception.Message)"
            $context.Response.StatusCode = 500
        } finally {
            $context.Response.Close()
        }
    }
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
    Write-Output 'MHG server stopped.'
}
