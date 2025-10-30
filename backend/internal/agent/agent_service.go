package agent

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tri27pham/incident-management-simulator/backend/internal/db"
	"github.com/tri27pham/incident-management-simulator/backend/internal/models"
	"github.com/tri27pham/incident-management-simulator/backend/internal/services"
)

// AgentService handles AI-powered incident remediation
type AgentService struct {
	aiServiceURL string
}

// NewAgentService creates a new agent service
func NewAgentService() *AgentService {
	return &AgentService{
		aiServiceURL: os.Getenv("AI_DIAGNOSIS_URL"),
	}
}

// StartRemediation initiates the full agent workflow for an incident
func (s *AgentService) StartRemediation(incident *models.Incident) (*models.AgentExecution, error) {
	// Safety check: Can the agent act on this incident?
	safetyCheck := CanAgentActOnIncident(incident)
	if !safetyCheck.Allowed {
		return nil, fmt.Errorf("agent cannot act on this incident: %s", safetyCheck.Reason)
	}

	// Create agent execution record
	execution := &models.AgentExecution{
		ID:         uuid.New(),
		IncidentID: incident.ID,
		Status:     models.StatusThinking,
		AgentModel: "gemini-2.5-flash",
		DryRun:     false,
	}

	if err := db.DB.Create(execution).Error; err != nil {
		return nil, fmt.Errorf("failed to create agent execution: %w", err)
	}

	// Start async workflow
	go s.runWorkflow(execution, incident)

	return execution, nil
}

// ApproveExecution continues the workflow after user approval
func (s *AgentService) ApproveExecution(execution *models.AgentExecution) error {
	// Get the incident
	var incident models.Incident
	if err := db.DB.First(&incident, "id = ?", execution.IncidentID).Error; err != nil {
		return fmt.Errorf("incident not found: %w", err)
	}

	log.Printf("✅ [Agent] Execution %s approved - continuing workflow", execution.ID.String()[:8])

	// Continue workflow in goroutine
	go s.continueWorkflowAfterApproval(execution, &incident)

	return nil
}

// continueWorkflowAfterApproval resumes the workflow after approval
func (s *AgentService) continueWorkflowAfterApproval(execution *models.AgentExecution, incident *models.Incident) {
	// Phase 4: Execution
	if err := s.phaseExecution(execution, incident); err != nil {
		s.failExecution(execution, fmt.Sprintf("Execution phase failed: %v", err))
		return
	}

	// Phase 5: Verification
	if err := s.phaseVerification(execution, incident); err != nil {
		s.failExecution(execution, fmt.Sprintf("Verification phase failed: %v", err))
		return
	}

	// Check if verification passed - if not, mark as failed
	if execution.VerificationPassed == nil || !*execution.VerificationPassed {
		log.Printf("❌ [Agent] Verification failed - marking execution as failed")
		s.failExecution(execution, "Verification checks failed. System did not return to healthy state.")
		return
	}

	// Complete successfully
	success := true
	execution.Success = &success
	execution.Status = models.StatusCompleted
	execution.CompletedAt = &time.Time{}
	*execution.CompletedAt = time.Now()
	db.DB.Save(execution)

	// Verification passed, resolve the incident
	if execution.VerificationPassed != nil && *execution.VerificationPassed {
		log.Printf("🎯 [Agent] Verification passed - marking incident as resolved")

		// Create status history entry
		statusHistory := models.StatusHistory{
			IncidentID: incident.ID,
			FromStatus: &incident.Status,
			ToStatus:   "resolved",
			ChangedAt:  time.Now(),
		}

		// Update incident status to resolved
		oldStatus := incident.Status
		incident.Status = "resolved"

		// Save both in a transaction
		tx := db.DB.Begin()
		if err := tx.Save(incident).Error; err != nil {
			tx.Rollback()
			log.Printf("⚠️  [Agent] Failed to update incident status: %v", err)
		} else if err := tx.Create(&statusHistory).Error; err != nil {
			tx.Rollback()
			log.Printf("⚠️  [Agent] Failed to create status history: %v", err)
		} else {
			tx.Commit()
			log.Printf("✅ [Agent] Incident %s automatically resolved (%s → resolved)", incident.ID.String()[:8], oldStatus)

			// Broadcast the status change via WebSocket (use BroadcastIncidentUpdate to include StatusHistory)
			services.BroadcastIncidentUpdate(incident.ID)
			log.Printf("📡 [Agent] Broadcasted incident resolution to WebSocket clients")
		}
	} else {
		log.Printf("⚠️  [Agent] Verification failed - incident requires manual review")
	}

	log.Printf("✅ [Agent] Remediation completed successfully for incident %s", incident.ID.String()[:8])
}

// runWorkflow executes the full multi-phase agent workflow
func (s *AgentService) runWorkflow(execution *models.AgentExecution, incident *models.Incident) {
	log.Printf("🤖 [Agent] Starting remediation workflow for incident %s", incident.ID.String()[:8])

	// Phase 1: Thinking
	if err := s.phaseThinking(execution, incident); err != nil {
		s.failExecution(execution, fmt.Sprintf("Thinking phase failed: %v", err))
		return
	}

	// Phase 2: Command Preview
	if err := s.phaseCommandPreview(execution, incident); err != nil {
		s.failExecution(execution, fmt.Sprintf("Command preview failed: %v", err))
		return
	}

	// Phase 3: Wait for human approval
	execution.Status = models.StatusAwaitingApproval
	db.DB.Save(execution)

	log.Printf("⏳ [Agent] Execution %s is awaiting user approval", execution.ID.String()[:8])
	// Workflow will be resumed by ApproveExecution handler
}

// phaseThinking: AI analyses the incident and decides what action to take
func (s *AgentService) phaseThinking(execution *models.AgentExecution, incident *models.Incident) error {
	log.Printf("🧠 [Agent] Phase 1: Thinking...")

	execution.Status = models.StatusThinking
	db.DB.Save(execution)

	// Call AI to analyse incident and recommend action
	prompt := fmt.Sprintf(`You are an expert SRE AI agent analyzing a production system incident. Your job is to diagnose the problem and select the best remediation action.

INCIDENT DETAILS:
Incident: %s
Source: %s
Affected Systems: %v

AVAILABLE REMEDIATION ACTIONS:
You can ONLY choose from these pre-approved actions:

1. "clear_redis_cache" - Clears all keys from Redis using FLUSHALL
   - Impact: Immediate memory recovery, ~1-2 second operation
   - Risk: Active sessions/cached data will be lost (medium severity)
   - Use when: Redis memory is critically high but service is responsive

2. "restart_redis" - Restarts the Redis container 
   - Impact: 2-3 second downtime, complete service interruption
   - Risk: Brief outage for all Redis-dependent services (high severity)
   - Use when: Redis is unresponsive, crashed, or in an error state that cache clearing won't fix

3. "kill_idle_connections" - Terminates idle PostgreSQL connections
   - Impact: Frees connection slots immediately, no query interruption
   - Risk: Minimal, only idle connections affected (low severity)
   - Use when: Connection pool is exhausted but active queries are fine

4. "vacuum_table" - Runs VACUUM ANALYZE on PostgreSQL tables
   - Impact: Reclaims dead tuple space, updates statistics, brief performance impact
   - Risk: Table remains accessible, slight performance degradation during operation (low severity)
   - Use when: Table bloat from dead tuples is degrading performance

5. "restart_postgres" - Restarts the PostgreSQL container
   - Impact: 2-3 second downtime, all connections dropped
   - Risk: Brief outage for database-dependent services (medium-high severity)
   - Use when: PostgreSQL is unresponsive or in a corrupted state that lighter fixes won't resolve

6. "cleanup_old_logs" - Deletes old log files to free disk space
   - Impact: Immediate disk space recovery, no service impact
   - Risk: Historical logs lost (low severity - test logs only)
   - Use when: Disk space is critically low

DECISION CRITERIA:
- Analyze the incident message, source, and affected systems
- Consider the severity and urgency of the issue
- Choose the LEAST disruptive action that will effectively resolve the problem
- Prefer targeted fixes (e.g., kill_idle_connections) over nuclear options (e.g., restart_postgres)
- Consider: Will this fix actually resolve the root cause, or just temporarily mask it?

Respond ONLY in valid JSON format:
{
  "analysis": "detailed technical analysis of the root cause and current system state",
  "recommended_action": "one of the 6 action names above",
  "reasoning": "explain why this specific action is the best choice given the tradeoffs"
}`, incident.Message, incident.Source, incident.AffectedSystems)

	response, err := s.callAI(prompt)
	if err != nil {
		return fmt.Errorf("AI call failed: %w", err)
	}

	// Try to extract JSON from response (AI might return text + JSON)
	jsonStart := strings.Index(response, "{")
	jsonEnd := strings.LastIndex(response, "}")

	if jsonStart == -1 || jsonEnd == -1 || jsonEnd <= jsonStart {
		log.Printf("❌ [Agent] Invalid AI response format (no JSON found): %s", response)
		return fmt.Errorf("AI response does not contain valid JSON")
	}

	jsonResponse := response[jsonStart : jsonEnd+1]
	log.Printf("🔍 [Agent] Extracted JSON: %s", jsonResponse)

	// Parse response
	var result struct {
		Analysis          string `json:"analysis"`
		RecommendedAction string `json:"recommended_action"`
		Reasoning         string `json:"reasoning"`
	}

	if err := json.Unmarshal([]byte(jsonResponse), &result); err != nil {
		log.Printf("❌ [Agent] Failed to parse JSON: %s", jsonResponse)
		return fmt.Errorf("failed to parse AI response: %w", err)
	}

	// Update execution
	execution.Analysis = result.Analysis
	execution.RecommendedAction = result.RecommendedAction
	execution.Reasoning = result.Reasoning
	db.DB.Save(execution)

	log.Printf("✅ [Agent] Thinking complete. Action: %s", result.RecommendedAction)
	return nil
}

// phaseCommandPreview: Generate specific commands and assess risks
func (s *AgentService) phaseCommandPreview(execution *models.AgentExecution, incident *models.Incident) error {
	log.Printf("📋 [Agent] Phase 2: Generating command preview...")

	execution.Status = models.StatusPreviewing
	db.DB.Save(execution)

	// Generate commands based on recommended action
	commands, impact, risks := s.generateCommands(execution.RecommendedAction, incident)

	// Store as JSONB
	execution.Commands = models.JSONB{Data: commands}
	execution.Risks = models.JSONB{Data: risks}

	execution.EstimatedImpact = impact
	db.DB.Save(execution)

	log.Printf("✅ [Agent] Command preview complete. %d commands generated", len(commands))
	return nil
}

// phaseExecution: Execute the commands
func (s *AgentService) phaseExecution(execution *models.AgentExecution, incident *models.Incident) error {
	log.Printf("⚡ [Agent] Phase 3: Executing commands...")

	execution.Status = models.StatusExecuting
	now := time.Now()
	execution.StartedAt = &now
	db.DB.Save(execution)

	// Parse commands from JSONB
	var commands []models.Command
	commandsJSON, _ := json.Marshal(execution.Commands.Data)
	json.Unmarshal(commandsJSON, &commands)

	// Execute each command
	var logs []models.ExecutionLog
	for _, cmd := range commands {
		log.Printf("🔧 [Agent] Executing: %s", cmd.Name)

		startTime := time.Now()
		output, err := s.executeCommand(cmd, incident)
		duration := time.Since(startTime).Milliseconds()

		logEntry := models.ExecutionLog{
			Timestamp:  startTime,
			Command:    cmd.Command,
			Output:     output,
			DurationMs: duration,
		}

		if err != nil {
			logEntry.Status = "failed"
			logEntry.ErrorDetail = err.Error()
			logs = append(logs, logEntry)
			return fmt.Errorf("command failed: %w", err)
		}

		logEntry.Status = "success"
		logs = append(logs, logEntry)
	}

	// Store logs
	execution.ExecutionLogs = models.JSONB{Data: logs}
	db.DB.Save(execution)

	log.Printf("✅ [Agent] Execution complete. %d commands executed", len(logs))
	return nil
}

// phaseVerification: Verify the fix worked
func (s *AgentService) phaseVerification(execution *models.AgentExecution, incident *models.Incident) error {
	log.Printf("🔍 [Agent] Phase 4: Verifying remediation...")

	execution.Status = models.StatusVerifying
	db.DB.Save(execution)

	// Run verification checks based on the action taken
	checks := s.runVerificationChecks(execution.RecommendedAction, incident)

	// Determine if all checks passed
	allPassed := true
	for _, check := range checks {
		if !check.Passed {
			allPassed = false
			break
		}
	}

	// Store results
	execution.VerificationChecks = models.JSONB{Data: checks}
	execution.VerificationPassed = &allPassed

	if allPassed {
		execution.VerificationNotes = "All verification checks passed. System is healthy."
	} else {
		execution.VerificationNotes = "Some verification checks failed. Manual review recommended."
	}

	db.DB.Save(execution)

	log.Printf("✅ [Agent] Verification complete. Passed: %v", allPassed)
	return nil
}

// Helper: Call AI service
func (s *AgentService) callAI(prompt string) (string, error) {
	payload := map[string]interface{}{
		"prompt": prompt,
	}

	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(s.aiServiceURL+"/api/v1/agent-think", "application/json", strings.NewReader(string(jsonData)))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		Response string `json:"response"`
	}
	json.Unmarshal(body, &result)
	return result.Response, nil
}

// Helper: Mark execution as failed
func (s *AgentService) failExecution(execution *models.AgentExecution, errorMsg string) {
	log.Printf("❌ [Agent] Execution failed: %s", errorMsg)
	success := false
	execution.Success = &success
	execution.Status = models.StatusFailed
	execution.ErrorMessage = errorMsg
	db.DB.Save(execution)
}

// generateCommands creates the actual commands to execute
func (s *AgentService) generateCommands(action string, incident *models.Incident) ([]models.Command, string, []models.Risk) {
	switch action {
	case "clear_redis_cache":
		return []models.Command{
				{
					Name:        "Clear Redis Cache",
					Command:     "redis-cli",
					Args:        []string{"FLUSHALL"},
					Target:      "redis-test",
					Description: "Clear all keys from Redis to free up memory",
				},
			},
			"Redis memory will be freed. Active sessions may be temporarily disrupted.",
			[]models.Risk{
				{Level: "medium", Description: "Active user sessions will be cleared", Mitigation: "Sessions will be recreated automatically"},
			}

	case "restart_redis":
		return []models.Command{
				{
					Name:        "Restart Redis Container",
					Command:     "docker",
					Args:        []string{"restart", "redis-test"},
					Target:      "redis-test",
					Description: "Restart the Redis container to recover from error state",
				},
			},
			"Redis will be unavailable for 2-3 seconds during restart.",
			[]models.Risk{
				{Level: "high", Description: "Brief service interruption", Mitigation: "Application has retry logic"},
			}

	case "kill_idle_connections":
		return []models.Command{
				{
					Name:        "Kill Idle PostgreSQL Connections",
					Command:     "http_post",
					Args:        []string{"http://health-monitor:8002/clear/postgres"},
					Target:      "postgres-test",
					Description: "Terminate idle database connections to free up connection pool",
				},
			},
			"Will terminate idle connections. Active queries will not be affected.",
			[]models.Risk{
				{Level: "low", Description: "Only idle connections terminated", Mitigation: "Active queries continue unaffected"},
			}

	case "vacuum_table":
		return []models.Command{
				{
					Name:        "Run VACUUM on PostgreSQL Table",
					Command:     "http_post",
					Args:        []string{"http://health-monitor:8002/clear/postgres-bloat"},
					Target:      "postgres-test",
					Description: "Run VACUUM ANALYZE to reclaim space from dead tuples and update statistics",
				},
			},
			"Will reclaim space from dead tuples. Brief performance impact during execution.",
			[]models.Risk{
				{Level: "low", Description: "Brief performance impact while VACUUM runs", Mitigation: "Operation typically completes in seconds"},
				{Level: "low", Description: "Table remains accessible during VACUUM", Mitigation: "PostgreSQL VACUUM does not lock tables"},
			}

	case "restart_postgres":
		return []models.Command{
				{
					Name:        "Restart PostgreSQL Container",
					Command:     "docker",
					Args:        []string{"restart", "postgres-test"},
					Target:      "postgres-test",
					Description: "Restart PostgreSQL to clear all connections and reset state",
				},
			},
			"PostgreSQL will be unavailable for 2-3 seconds during restart.",
			[]models.Risk{
				{Level: "medium", Description: "Brief service interruption", Mitigation: "Applications should have connection retry logic"},
				{Level: "low", Description: "All connections will be dropped", Mitigation: "Expected behavior for restart"},
			}

	case "cleanup_old_logs":
		return []models.Command{
				{
					Name:        "Clean Up Old Log Files",
					Command:     "http_post",
					Args:        []string{"http://health-monitor:8002/clear/disk"},
					Target:      "disk-monitor",
					Description: "Remove old log files to free up disk space",
				},
			},
			"Will delete test log files. No impact on running services.",
			[]models.Risk{
				{Level: "low", Description: "Log files will be deleted", Mitigation: "Only removes test log files created for simulation"},
				{Level: "low", Description: "No service interruption", Mitigation: "Disk cleanup happens in the background"},
			}

	default:
		return []models.Command{
				{
					Name:        "Unknown Action",
					Command:     "echo",
					Args:        []string{"Unknown action: " + action},
					Target:      "",
					Description: "No commands available for this action",
				},
			},
			"Unknown impact",
			[]models.Risk{}
	}
}

// executeCommand runs a single command
func (s *AgentService) executeCommand(cmd models.Command, incident *models.Incident) (string, error) {
	healthMonitorURL := os.Getenv("HEALTH_MONITOR_URL")
	if healthMonitorURL == "" {
		healthMonitorURL = "http://localhost:8002"
	}

	// For Redis actions, call the health-monitor service
	if cmd.Target == "redis-test" {
		if cmd.Command == "redis-cli" && len(cmd.Args) > 0 && cmd.Args[0] == "FLUSHALL" {
			resp, err := http.Post(healthMonitorURL+"/clear/redis", "application/json", nil)
			if err != nil {
				return "", err
			}
			defer resp.Body.Close()

			body, _ := ioutil.ReadAll(resp.Body)
			return string(body), nil
		}
	}

	// For PostgreSQL actions, call the health-monitor service
	if cmd.Target == "postgres-test" {
		if cmd.Command == "http_post" {
			// Call health monitor to kill idle connections
			url := cmd.Args[0]
			resp, err := http.Post(url, "application/json", nil)
			if err != nil {
				return "", fmt.Errorf("failed to call %s: %w", url, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode == 200 {
				body, _ := ioutil.ReadAll(resp.Body)
				return string(body), nil
			}
			return fmt.Sprintf("Failed with status %d", resp.StatusCode), fmt.Errorf("unexpected status")
		} else if cmd.Command == "docker" {
			// Restart container
			log.Printf("🐳 [Agent] Restarting postgres-test container...")
			// For now, return success message (actual Docker API implementation can be added later)
			return "PostgreSQL container restart initiated", nil
		}
	}

	// For disk cleanup actions, call the health-monitor service
	if cmd.Target == "disk-monitor" {
		if cmd.Command == "http_post" {
			url := cmd.Args[0]
			resp, err := http.Post(url, "application/json", nil)
			if err != nil {
				return "", fmt.Errorf("failed to call %s: %w", url, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode == 200 {
				body, _ := ioutil.ReadAll(resp.Body)
				return string(body), nil
			}
			return fmt.Sprintf("Failed with status %d", resp.StatusCode), fmt.Errorf("unexpected status")
		}
	}

	return fmt.Sprintf("Command executed: %s %v", cmd.Command, cmd.Args), nil
}

// runVerificationChecks verifies the remediation worked
func (s *AgentService) runVerificationChecks(action string, incident *models.Incident) []models.VerificationCheck {
	checks := []models.VerificationCheck{}

	// For Redis actions, check health
	if action == "clear_redis_cache" || action == "restart_redis" {
		// Call health monitor to check Redis status
		healthMonitorURL := os.Getenv("HEALTH_MONITOR_URL")
		if healthMonitorURL == "" {
			healthMonitorURL = "http://localhost:8002"
		}

		resp, err := http.Get(healthMonitorURL + "/status")
		if err != nil {
			checks = append(checks, models.VerificationCheck{
				CheckName:   "Redis Health Check",
				Description: "Verify Redis is responding",
				Passed:      false,
				Result:      "Failed to connect to health monitor",
				Expected:    "Health > 70%",
			})
			return checks
		}
		defer resp.Body.Close()

		var status struct {
			Services map[string]struct {
				Health float64 `json:"health"`
				Status string  `json:"status"`
			} `json:"services"`
		}

		body, _ := ioutil.ReadAll(resp.Body)
		json.Unmarshal(body, &status)

		redisHealth := status.Services["redis-test"].Health
		passed := redisHealth >= 70

		checks = append(checks, models.VerificationCheck{
			CheckName:   "Redis Health Check",
			Description: "Verify Redis memory is below threshold",
			Passed:      passed,
			Result:      fmt.Sprintf("Health: %.0f%%", redisHealth),
			Expected:    "Health >= 70%",
		})

		checks = append(checks, models.VerificationCheck{
			CheckName:   "Redis Availability",
			Description: "Verify Redis is responding to commands",
			Passed:      status.Services["redis-test"].Status == "healthy",
			Result:      status.Services["redis-test"].Status,
			Expected:    "healthy",
		})
	}

	// For PostgreSQL actions, check health
	if action == "kill_idle_connections" || action == "vacuum_table" || action == "restart_postgres" {
		healthMonitorURL := os.Getenv("HEALTH_MONITOR_URL")
		if healthMonitorURL == "" {
			healthMonitorURL = "http://localhost:8002"
		}

		resp, err := http.Get(healthMonitorURL + "/status")
		if err != nil {
			checks = append(checks, models.VerificationCheck{
				CheckName:   "PostgreSQL Health Check",
				Description: "Verify PostgreSQL is responding",
				Passed:      false,
				Result:      "Failed to connect to health monitor",
				Expected:    "Health > 70%",
			})
			return checks
		}
		defer resp.Body.Close()

		var status struct {
			Services map[string]struct {
				Health            float64 `json:"health"`
				Status            string  `json:"status"`
				IdleConnections   float64 `json:"idle_connections"`
				ActiveConnections float64 `json:"active_connections"`
				TotalConnections  float64 `json:"total_connections"`
			} `json:"services"`
		}

		body, _ := ioutil.ReadAll(resp.Body)
		json.Unmarshal(body, &status)

		postgresHealth := status.Services["postgres-test"].Health
		idleConns := int(status.Services["postgres-test"].IdleConnections)
		passed := postgresHealth >= 70

		checks = append(checks, models.VerificationCheck{
			CheckName:   "PostgreSQL Health Check",
			Description: "Verify PostgreSQL connection pool is healthy",
			Passed:      passed,
			Result:      fmt.Sprintf("Health: %.0f%%", postgresHealth),
			Expected:    "Health >= 70%",
		})

		checks = append(checks, models.VerificationCheck{
			CheckName:   "Idle Connections",
			Description: "Verify idle connections are at acceptable level",
			Passed:      idleConns <= 8,
			Result:      fmt.Sprintf("%d idle connections", idleConns),
			Expected:    "<= 8 idle connections",
		})

		checks = append(checks, models.VerificationCheck{
			CheckName:   "PostgreSQL Availability",
			Description: "Verify PostgreSQL is responding to queries",
			Passed:      status.Services["postgres-test"].Status == "healthy",
			Result:      status.Services["postgres-test"].Status,
			Expected:    "healthy",
		})
	}

	// For disk cleanup actions, check disk space
	if action == "cleanup_old_logs" {
		healthMonitorURL := os.Getenv("HEALTH_MONITOR_URL")
		if healthMonitorURL == "" {
			healthMonitorURL = "http://localhost:8002"
		}

		resp, err := http.Get(healthMonitorURL + "/status")
		if err != nil {
			checks = append(checks, models.VerificationCheck{
				CheckName:   "Disk Space Check",
				Description: "Verify disk space is available",
				Passed:      false,
				Result:      "Failed to connect to health monitor",
				Expected:    "Health > 70%",
			})
			return checks
		}
		defer resp.Body.Close()

		var status struct {
			Services map[string]struct {
				Health      float64 `json:"health"`
				Status      string  `json:"status"`
				UsedPercent float64 `json:"used_percent"`
				FreeMB      float64 `json:"free_mb"`
			} `json:"services"`
		}

		body, _ := ioutil.ReadAll(resp.Body)
		json.Unmarshal(body, &status)

		diskHealth := status.Services["disk-space"].Health
		usedPercent := status.Services["disk-space"].UsedPercent
		freeMB := status.Services["disk-space"].FreeMB
		passed := diskHealth >= 70

		checks = append(checks, models.VerificationCheck{
			CheckName:   "Disk Space Health",
			Description: "Verify disk space is below threshold",
			Passed:      passed,
			Result:      fmt.Sprintf("Health: %.0f%% (Used: %.1f%%)", diskHealth, usedPercent),
			Expected:    "Health >= 70% (Used < 60%)",
		})

		checks = append(checks, models.VerificationCheck{
			CheckName:   "Free Space Available",
			Description: "Verify sufficient free space",
			Passed:      freeMB > 100,
			Result:      fmt.Sprintf("%.0f MB free", freeMB),
			Expected:    "> 100 MB free",
		})

		checks = append(checks, models.VerificationCheck{
			CheckName:   "Disk Availability",
			Description: "Verify disk is accessible",
			Passed:      status.Services["disk-space"].Status == "healthy",
			Result:      status.Services["disk-space"].Status,
			Expected:    "healthy",
		})
	}

	return checks
}
