# Define the base URL - adjust this to match your server
$baseUrl = "http://localhost:3000"

# Function to make API requests and display results
function Test-Endpoint {
    param (
        [string]$Method,
        [string]$Endpoint,
        [string]$Description,
        [object]$Body = $null
    )
    
    Write-Host "`n===== Testing: $Description =====" -ForegroundColor Cyan
    Write-Host "$Method $Endpoint" -ForegroundColor Yellow
    
    $params = @{
        Method = $Method
        Uri = "$baseUrl$Endpoint"
        ContentType = "application/json"
        ErrorAction = "SilentlyContinue"
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json)
        Write-Host "Request Body: $($params.Body)" -ForegroundColor Gray
    }
    
    try {
        $response = Invoke-RestMethod @params
        Write-Host "Status: SUCCESS" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Magenta
        $response | ConvertTo-Json -Depth 4 | Write-Host -ForegroundColor White
    }
    catch {
        Write-Host "Status: FAILED" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            Write-Host "Status Code: $statusCode" -ForegroundColor Red
        }
    }
}

Write-Host "Starting API Endpoint Tests..." -ForegroundColor Green

# Test Events Endpoints
Test-Endpoint -Method "GET" -Endpoint "/events" -Description "Get all events"

Test-Endpoint -Method "POST" -Endpoint "/events" -Description "Create a new event" -Body @{
    title = "Test Event"
    description = "This is a test event created by PowerShell"
    date = (Get-Date).ToString("yyyy-MM-dd")
    location = "Virtual"
}

Test-Endpoint -Method "GET" -Endpoint "/events/123" -Description "Get event by ID"

Test-Endpoint -Method "GET" -Endpoint "/events/user/456" -Description "Get events by user ID"

# Test Users Endpoints
Test-Endpoint -Method "GET" -Endpoint "/users" -Description "Get all users"

Test-Endpoint -Method "GET" -Endpoint "/users/789" -Description "Get user by ID"

Write-Host "`nAPI Endpoint Tests Completed!" -ForegroundColor Green