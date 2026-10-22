# Spec Delta: init-doctor

## ADDED Requirements

### Requirement: Doctor checks Supabase and Docker tools
When a platform has stack `supabase`, `doctor` SHALL check that `supabase` CLI is installed and that `docker` is installed and running, reporting failures or warnings with fix instructions when either is missing or when the Docker engine is stopped.

#### Scenario: Supabase CLI missing
- **WHEN** a platform has stack `supabase` and `supabase` is not installed
- **THEN** `doctor` reports `tools.supabase` as failed with the installation command

#### Scenario: Docker daemon not running
- **WHEN** `docker` CLI is installed but the Docker engine/daemon is stopped
- **THEN** `doctor` reports `tools.docker` with a warning or failure indicating the daemon is stopped and instructing the user to launch Docker Desktop or OrbStack

#### Scenario: Supabase tools fully operational
- **WHEN** `supabase` is installed and `docker info` succeeds
- **THEN** `doctor` reports `tools.supabase` and `tools.docker` as passed

### Requirement: Init assists Supabase stack setup
When `init` detects or configures a platform with stack `supabase`, it SHALL offer to install the official Supabase agent skills (`npx skills add supabase/agent-skills`) as a confirmed install step. In its report or manual steps, `init` SHALL provide copy-pasteable instructions for configuring the Supabase MCP server in supported coding agents (Claude Code and Antigravity) and instructions for installing Docker or Supabase CLI if missing.

#### Scenario: Init offers Supabase skills install
- **WHEN** `init` plans a repository with a `supabase` platform and the skills are missing
- **THEN** it displays `npx skills add supabase/agent-skills` as an install step to confirm

#### Scenario: Init guidance for Supabase MCP
- **WHEN** `init` finishes configuring a `supabase` platform
- **THEN** its final manual steps list the command to add the Supabase MCP server for interactive design sessions
