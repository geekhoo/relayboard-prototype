# Reproduces the consumer-side demonstration for @relayboard/skills.
# Run from packages/relayboard-skills after `npm pack` has produced
# relayboard-skills-0.1.0.tgz in the package root.
$ErrorActionPreference = 'Stop'
$demo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $demo

function Write-Step($text) {
  Write-Host ""
  Write-Host "===== $text =====" -ForegroundColor Cyan
}

function Set-Allowlist([string[]] $skills) {
  $manifest = Get-Content package.json -Raw | ConvertFrom-Json
  # Add-Member, not `$manifest.intent = ...`: assignment to a property that a
  # PSCustomObject does not already have throws rather than adding it.
  $manifest | Add-Member -NotePropertyName intent -NotePropertyValue ([pscustomobject]@{ skills = $skills }) -Force
  $manifest | ConvertTo-Json -Depth 8 | Set-Content package.json -Encoding utf8
}

Write-Step '0. install the packed tarball'
npm install ../relayboard-skills-0.1.0.tgz

Write-Step '1. no allowlist: discovery surfaces everything with a migration notice'
$manifest = Get-Content package.json -Raw | ConvertFrom-Json
$manifest.PSObject.Properties.Remove('intent')
$manifest | ConvertTo-Json -Depth 8 | Set-Content package.json -Encoding utf8
npx intent list

Write-Step '2. explicit allowlist: one package entry plus one exact-skill entry'
Set-Allowlist @('@relayboard/skills', '@relayboard/skills#relayboard-identity')
npx intent list

Write-Step '3. exact-skill allowlist only'
Set-Allowlist @('@relayboard/skills#relayboard-identity')
npx intent list

Write-Step '4. load the allowed skill'
npx intent load '@relayboard/skills#relayboard-identity'

Write-Step '5. loading an unlisted skill is refused'
npx intent load '@relayboard/skills#relayboard-thread-sequencing'

Write-Step '6. exclude one skill; the package allowlist stays'
Set-Allowlist @('@relayboard/skills')
npx intent exclude add '@relayboard/skills#relayboard-mock-api'
npx intent exclude list --json
npx intent list
npx intent load '@relayboard/skills#relayboard-mock-api'

Write-Step '7. remove the exclusion again'
npx intent exclude remove '@relayboard/skills#relayboard-mock-api'
npx intent list
