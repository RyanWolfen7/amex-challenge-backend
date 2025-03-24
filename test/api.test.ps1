<#
.SYNOPSIS
    Test script for the events API with circuit breaker
.DESCRIPTION
    This script tests the various endpoints of the events API
    and demonstrates the circuit breaker behavior under load
.NOTES
    Author: Ryan
    Date: March 23, 2025
#>

# Configuration
$baseUrl = "http://localhost:3000/events"
$outputFolder = ".\test-results"
$colorSuccess = "Green"
$colorWarning = "Yellow"
$colorError = "Red"
$colorInfo = "Cyan"

# Create output folder if it doesn't exist
if (!(Test-Path $outputFolder)) {
    New-Item -ItemType Directory -Path $outputFolder | Out-Null
}

# Setup log file
$logFile = "$outputFolder\api-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
"API Test Run - $(Get-Date)" | Out-File -FilePath $logFile

# Helper Functions
function Write-LogMessage {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$false)]
        [string]$Color = "White",
        
        [Parameter(Mandatory=$false)]
        [switch]$NoConsole
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $logFile -Append
    
    if (!$NoConsole) {
        Write-Host "$timestamp - $Message" -ForegroundColor $Color
    }
}

function Invoke-TimedRequest {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Uri,
        
        [Parameter(Mandatory=$false)]
        [string]$Method = "GET",
        
        [Parameter(Mandatory=$false)]
        [string]$Body,
        
        [Parameter(Mandatory=$false)]
        [string]$ContentType = "application/json",
        
        [Parameter(Mandatory=$false)]
        [string]$Description = ""
    )
    
    $requestId = [Guid]::NewGuid().ToString().Substring(0, 8)
    $start = Get-Date
    
    Write-LogMessage "[$requestId] Starting $Method request to $Uri $Description" -Color $colorInfo
    
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            ErrorAction = "Stop"
        }
        
        if ($Method -eq "POST" -and $Body) {
            $params.Body = $Body
            $params.ContentType = $ContentType
        }
        
        $response = Invoke-RestMethod @params
        $end = Get-Date
        $duration = ($end - $start).TotalMilliseconds
        
        Write-LogMessage "[$requestId] Success: $Method $Uri completed in $([math]::Round($duration, 2))ms" -Color $colorSuccess
        
        return @{
            RequestId = $requestId
            Success = $true
            Duration = [math]::Round($duration, 2)
            Response = $response
            StatusCode = 200
        }
    }
    catch {
        $end = Get-Date
        $duration = ($end - $start).TotalMilliseconds
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorDetails = if ($_.ErrorDetails) { $_.ErrorDetails.Message } else { $_.Exception.Message }
        
        Write-LogMessage "[$requestId] Failed: $Method $Uri failed after $([math]::Round($duration, 2))ms with status $statusCode" -Color $colorError
        
        return @{
            RequestId = $requestId
            Success = $false
            Duration = [math]::Round($duration, 2)
            Error = $errorDetails
            StatusCode = $statusCode
        }
    }
}

function Show-Menu {
    Clear-Host
    Write-Host "=== Events API Testing Tool ===" -ForegroundColor Magenta
    Write-Host "1. Test Get All Events"
    Write-Host "2. Test Get Event by ID"
    Write-Host "3. Test Get User Events"
    Write-Host "4. Add a Single Event"
    Write-Host "5. Check Circuit Breaker Status"
    Write-Host "6. Circuit Breaker Test (Multiple Requests)"
    Write-Host "7. Load Test (Concurrent Requests)"
    Write-Host "8. Monitor Circuit Breaker State"
    Write-Host "Q. Quit"
    Write-Host
    $choice = Read-Host "Select an option"
    return $choice
}

function Test-GetAllEvents {
    Write-LogMessage "Testing Get All Events endpoint" -Color $colorInfo
    $result = Invoke-TimedRequest -Uri "$baseUrl" -Description "Get all events"
    
    if ($result.Success) {
        $eventsCount = ($result.Response | Measure-Object).Count
        Write-LogMessage "Retrieved $eventsCount events in $($result.Duration)ms" -Color $colorSuccess
        $result.Response | ConvertTo-Json -Depth 4 | Out-File "$outputFolder\all-events.json"
    }
}

function Test-GetEventById {
    $eventId = Read-Host "Enter event ID (e.g., event-1)"
    
    Write-LogMessage "Testing Get Event by ID endpoint for $eventId" -Color $colorInfo
    $result = Invoke-TimedRequest -Uri "$baseUrl/$eventId" -Description "Get event $eventId"
    
    if ($result.Success) {
        Write-LogMessage "Retrieved event $eventId in $($result.Duration)ms" -Color $colorSuccess
        $result.Response | ConvertTo-Json -Depth 4 | Out-File "$outputFolder\event-$eventId.json"
    }
}

function Test-GetUserEvents {
    $userId = Read-Host "Enter user ID (e.g., 1)"
    
    Write-LogMessage "Testing Get User Events endpoint for user $userId" -Color $colorInfo
    $result = Invoke-TimedRequest -Uri "$baseUrl/user/$userId" -Description "Get events for user $userId"
    
    if ($result.Success) {
        $eventsCount = ($result.Response | Measure-Object).Count
        Write-LogMessage "Retrieved $eventsCount events for user $userId in $($result.Duration)ms" -Color $colorSuccess
        $result.Response | ConvertTo-Json -Depth 4 | Out-File "$outputFolder\user-$userId-events.json"
    }
}

function Test-AddEvent {
    Write-LogMessage "Testing Add Event endpoint" -Color $colorInfo
    
    $eventTitle = Read-Host "Enter event title"
    $eventDescription = Read-Host "Enter event description"
    $userId = Read-Host "Enter user ID"
    
    $body = @{
        title = $eventTitle
        description = $eventDescription
        date = (Get-Date).AddDays(7).ToString("o")
        location = "Virtual"
        userId = [int]$userId
    } | ConvertTo-Json
    
    $result = Invoke-TimedRequest -Uri "$baseUrl" -Method POST -Body $body -Description "Add new event '$eventTitle'"
    
    if ($result.Success) {
        Write-LogMessage "Event added successfully in $($result.Duration)ms" -Color $colorSuccess
        $result.Response | ConvertTo-Json -Depth 4 | Out-File "$outputFolder\added-event.json"
    }
}

function Test-CircuitBreakerStatus {
    Write-LogMessage "Checking Circuit Breaker Status" -Color $colorInfo
    $result = Invoke-TimedRequest -Uri "$baseUrl/circuit-status" -Description "Get circuit breaker status"
    
    if ($result.Success) {
        $status = $result.Response
        
        foreach ($service in $status.PSObject.Properties) {
            $serviceState = $service.Value.state
            $stateColor = switch ($serviceState) {
                "CLOSED" { $colorSuccess }
                "HALF_OPEN" { $colorWarning }
                "OPEN" { $colorError }
                default { "White" }
            }
            
            Write-LogMessage "Service: $($service.Name)" -Color $colorInfo
            Write-LogMessage "  State: $serviceState" -Color $stateColor
            Write-LogMessage "  Failures: $($service.Value.failures)" -Color $stateColor
            
            if ($service.Value.lastFailure) {
                Write-LogMessage "  Last Failure: $($service.Value.lastFailure)" -Color $stateColor
                Write-LogMessage "  Since Last Failure: $($service.Value.sinceLastFailure)ms" -Color $stateColor
            }
        }
        
        $status | ConvertTo-Json -Depth 4 | Out-File "$outputFolder\circuit-status.json"
    }
}

function Test-CircuitBreaker {
    $requestCount = [int](Read-Host "Enter number of requests to send (recommended: 10-20)")
    $delayMs = [int](Read-Host "Enter delay between requests in ms (recommended: 500)")
    
    Write-LogMessage "Starting Circuit Breaker Test with $requestCount requests" -Color $colorInfo
    
    $results = @()
    
    for ($i = 1; $i -le $requestCount; $i++) {
        $body = @{
            title = "Circuit Test Event $i"
            description = "Testing circuit breaker behavior with event $i"
            date = (Get-Date).AddDays($i).ToString("o")
            userId = 1
        } | ConvertTo-Json
        
        $result = Invoke-TimedRequest -Uri "$baseUrl/addEvent" -Method POST -Body $body -Description "Circuit breaker test #$i"
        $results += $result
        
        # Check circuit status every few requests
        if ($i % 3 -eq 0 -or $i -eq $requestCount) {
            $circuitStatus = Invoke-TimedRequest -Uri "$baseUrl/circuit-status"
            if ($circuitStatus.Success) {
                foreach ($service in $circuitStatus.Response.PSObject.Properties) {
                    $state = $service.Value.state
                    $stateColor = switch ($state) {
                        "CLOSED" { $colorSuccess }
                        "HALF_OPEN" { $colorWarning }
                        "OPEN" { $colorError }
                        default { "White" }
                    }
                    
                    Write-LogMessage "After request #$i - Service $($service.Name) is in state: $state (Failures: $($service.Value.failures))" -Color $stateColor
                }
            }
        }
        
        if ($delayMs -gt 0) {
            Start-Sleep -Milliseconds $delayMs
        }
    }
    
    # Summary
    $successful = ($results | Where-Object { $_.Success } | Measure-Object).Count
    $failed = $requestCount - $successful
    
    Write-LogMessage "Circuit Breaker Test Summary:" -Color $colorInfo
    Write-LogMessage "Total Requests: $requestCount" -Color $colorInfo
    Write-LogMessage "Successful: $successful" -Color $colorSuccess
    Write-LogMessage "Failed: $failed" -Color $colorError
    
    if ($failed -gt 0) {
        $failedStatuses = $results | Where-Object { -not $_.Success } | Group-Object -Property StatusCode | Select-Object Name, Count
        Write-LogMessage "Failed status codes:" -Color $colorInfo
        foreach ($status in $failedStatuses) {
            Write-LogMessage "  $($status.Name): $($status.Count)" -Color $colorError
        }
        
        # Check for 503 errors which indicate circuit open
        $circuitOpenCount = ($results | Where-Object { -not $_.Success -and $_.StatusCode -eq 503 } | Measure-Object).Count
        if ($circuitOpenCount -gt 0) {
            Write-LogMessage "Circuit opened during test and returned $circuitOpenCount 503 responses" -Color $colorWarning
        }
    }
    
    $results | ConvertTo-Json -Depth 4 | Out-File "$outputFolder\circuit-breaker-test.json"
}

function Test-ConcurrentRequests {
    $concurrentRequests = [int](Read-Host "Enter number of concurrent requests (recommended: 5-20)")
    
    Write-LogMessage "Starting Load Test with $concurrentRequests concurrent requests" -Color $colorInfo
    
    # Create an array of scriptblocks for parallel execution
    $scriptBlocks = @()
    
    for ($i = 1; $i -le $concurrentRequests; $i++) {
        $body = @{
            title = "Concurrent Test $i"
            description = "Testing concurrent requests with event $i"
            date = (Get-Date).AddDays($i).ToString("o")
            userId = ($i % 3) + 1  # Distribute across 3 users
        } | ConvertTo-Json
        
        $scriptBlocks += [ScriptBlock]::Create(@"
            `$start = Get-Date
            try {
                `$response = Invoke-RestMethod -Uri "$baseUrl/addEvent" -Method POST -Body '$body' -ContentType "application/json" -ErrorAction Stop
                `$end = Get-Date
                `$duration = (`$end - `$start).TotalMilliseconds
                
                return @{
                    Index = $i
                    Success = `$true
                    Duration = [math]::Round(`$duration, 2)
                    StatusCode = 200
                    Response = `$response
                }
            }
            catch {
                `$end = Get-Date
                `$duration = (`$end - `$start).TotalMilliseconds
                `$statusCode = `$_.Exception.Response.StatusCode.value__
                
                return @{
                    Index = $i
                    Success = `$false
                    Duration = [math]::Round(`$duration, 2)
                    StatusCode = `$statusCode
                    Error = `$_.Exception.Message
                }
            }
"@)
    }
    
    # Start all jobs
    $jobs = @()
    for ($i = 0; $i -lt $concurrentRequests; $i++) {
        $jobs += Start-Job -ScriptBlock $scriptBlocks[$i]
    }
    
    Write-LogMessage "Started $($jobs.Count) concurrent jobs" -Color $colorInfo
    
    # Wait for all jobs to complete
    $null = $jobs | Wait-Job
    
    # Get results
    $results = $jobs | Receive-Job
    
    # Sort results by index
    $results = $results | Sort-Object -Property Index
    
    # Display results
    $successful = ($results | Where-Object { $_.Success } | Measure-Object).Count
    $failed = $concurrentRequests - $successful
    
    Write-LogMessage "Load Test Results:" -Color $colorInfo
    Write-LogMessage "Total Requests: $concurrentRequests" -Color $colorInfo
    Write-LogMessage "Successful: $successful" -Color $colorSuccess
    Write-LogMessage "Failed: $failed" -Color if ($failed -gt 0) { $colorError } else { $colorSuccess }
    
    $avgDuration = ($results | Measure-Object -Property Duration -Average).Average
    $minDuration = ($results | Measure-Object -Property Duration -Minimum).Minimum
    $maxDuration = ($results | Measure-Object -Property Duration -Maximum).Maximum
    
    Write-LogMessage "Response Times:" -Color $colorInfo
    Write-LogMessage "  Min: $minDuration ms" -Color $colorInfo
    Write-LogMessage "  Avg: $([math]::Round($avgDuration, 2)) ms" -Color $colorInfo
    Write-LogMessage "  Max: $maxDuration ms" -Color $colorInfo
    
    if ($failed -gt 0) {
        $failedStatuses = $results | Where-Object { -not $_.Success } | Group-Object -Property StatusCode | Select-Object Name, Count
        Write-LogMessage "Failed status codes:" -Color $colorInfo
        foreach ($status in $failedStatuses) {
            Write-LogMessage "  $($status.Name): $($status.Count)" -Color $colorError
        }
    }
    
    # Check circuit breaker status
    $circuitStatus = Invoke-TimedRequest -Uri "$baseUrl/circuit-status"
    if ($circuitStatus.Success) {
        Write-LogMessage "Circuit Breaker Status after Load Test:" -Color $colorInfo
        foreach ($service in $circuitStatus.Response.PSObject.Properties) {
            $state = $service.Value.state
            $stateColor = switch ($state) {
                "CLOSED" { $colorSuccess }
                "HALF_OPEN" { $colorWarning }
                "OPEN" { $colorError }
                default { "White" }
            }
            
            Write-LogMessage "Service $($service.Name) is in state: $state (Failures: $($service.Value.failures))" -Color $stateColor
        }
    }
    
    # Clean up
    $jobs | Remove-Job
    
    $results | ConvertTo-Json -Depth 4 | Out-File "$outputFolder\load-test-results.json"
}

function Monitor-CircuitBreakerState {
    $monitorDuration = [int](Read-Host "Enter monitoring duration in seconds (Ctrl+C to stop)")
    $previousState = $null
    $counter = 0
    $startTime = Get-Date
    
    Write-Host "Monitoring circuit breaker state for $monitorDuration seconds..." -ForegroundColor $colorInfo
    Write-Host "Press Ctrl+C to stop monitoring." -ForegroundColor $colorInfo
    
    try {
        while ((Get-Date) -lt ($startTime.AddSeconds($monitorDuration))) {
            $counter++
            $circuitStatus = Invoke-TimedRequest -Uri "$baseUrl/circuit-status" -NoConsole
            
            if ($circuitStatus.Success) {
                foreach ($service in $circuitStatus.Response.PSObject.Properties) {
                    $currentState = $service.Value.state
                    
                    # Show state changes or periodic updates
                    if ($currentState -ne $previousState -or $counter % 5 -eq 0) {
                        $stateColor = switch ($currentState) {
                            "CLOSED" { $colorSuccess }
                            "HALF_OPEN" { $colorWarning }
                            "OPEN" { $colorError }
                            default { "White" }
                        }
                        
                        $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
                        Write-Host "[$elapsed sec] $($service.Name) state: $currentState (Failures: $($service.Value.failures))" -ForegroundColor $stateColor
                        
                        $previousState = $currentState
                    }
                }
            }
            
            Start-Sleep -Seconds 1
        }
    }
    catch {
        Write-Host "Monitoring stopped" -ForegroundColor $colorWarning
    }
    finally {
        Write-Host "Monitoring complete after $counter checks" -ForegroundColor $colorInfo
    }
}

# Main menu loop
$quit = $false
while (-not $quit) {
    $choice = Show-Menu
    
    switch ($choice) {
        "1" { Test-GetAllEvents; Read-Host "Press Enter to continue" }
        "2" { Test-GetEventById; Read-Host "Press Enter to continue" }
        "3" { Test-GetUserEvents; Read-Host "Press Enter to continue" }
        "4" { Test-AddEvent; Read-Host "Press Enter to continue" }
        "5" { Test-CircuitBreakerStatus; Read-Host "Press Enter to continue" }
        "6" { Test-CircuitBreaker; Read-Host "Press Enter to continue" }
        "7" { Test-ConcurrentRequests; Read-Host "Press Enter to continue" }
        "8" { Monitor-CircuitBreakerState; Read-Host "Press Enter to continue" }
        "Q" { $quit = $true }
        "q" { $quit = $true }
        default { Write-Host "Invalid option" -ForegroundColor $colorError }
    }
}

Write-Host "Tests completed. Log file: $logFile" -ForegroundColor $colorInfo