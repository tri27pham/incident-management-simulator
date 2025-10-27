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
	ws "github.com/tri27pham/incident-management-simulator/backend/internal/websocket"
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

	// Phase 3: Auto-approve for now (in production, this would wait for human approval)
	execution.Status = models.StatusAwaitingApproval
	db.DB.Save(execution)
	time.Sleep(2 * time.Second) // Simulate approval delay

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

	// Complete
	success := true
	execution.Success = &success
	execution.Status = models.StatusCompleted
	execution.CompletedAt = &time.Time{}
	*execution.CompletedAt = time.Now()
	db.DB.Save(execution)

	// If remediation was successful and verification passed, resolve the incident
	if execution.VerificationPassed != nil && *execution.VerificationPassed {
		log.Printf("🎯 [Agent] Verification passed - marking incident as resolved")

		// Create status history entry
		statusHistory := models.StatusHistory{
			IncidentID: incident.ID,
			FromStatus: &incident.Status,
			ToStatus:   "resolved",
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

			// Broadcast the status change via WebSocket
			ws.WSHub.Broadcast <- incident
			log.Printf("📡 [Agent] Broadcasted incident resolution to WebSocket clients")
		}
	} else {
		log.Printf("⚠️  [Agent] Verification failed - incident requires manual review")
	}

	log.Printf("✅ [Agent] Remediation completed successfully for incident %s", incident.ID.String()[:8])
}

// phaseThinking: AI analyzes the incident and decides what action to take
func (s *AgentService) phaseThinking(execution *models.AgentExecution, incident *models.Incident) error {
	log.Printf("🧠 [Agent] Phase 1: Thinking...")

	execution.Status = models.StatusThinking
	db.DB.Save(execution)

	// Call AI to analyze incident and recommend action
	prompt := fmt.Sprintf(`You are an AI agent analyzing a system incident.

Incident: %s
Source: %s
Affected Systems: %v

Analyze this incident and recommend a remediation action.
You can ONLY use these available actions:
- "clear_redis_cache" - Clear all keys from Redis to free up memory (best for memory exhaustion)
- "restart_redis" - Restart the Redis container to recover from error state

Choose the action that best addresses the issue. For memory problems, use clear_redis_cache.

Respond ONLY in valid JSON:
{
  "analysis": "brief technical analysis of the root cause",
  "recommended_action": "clear_redis_cache" or "restart_redis",
  "reasoning": "why this action will fix the issue"
}`, incident.Message, incident.Source, incident.AffectedSystems)

	response, err := s.callAI(prompt)
	if err != nil {
		return fmt.Errorf("AI call failed: %w", err)
	}

	// Parse response
	var result struct {
		Analysis          string `json:"analysis"`
		RecommendedAction string `json:"recommended_action"`
		Reasoning         string `json:"reasoning"`
	}

	if err := json.Unmarshal([]byte(response), &result); err != nil {
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
	// For Redis actions, call the health-monitor service
	if cmd.Target == "redis-test" {
		healthMonitorURL := os.Getenv("HEALTH_MONITOR_URL")
		if healthMonitorURL == "" {
			healthMonitorURL = "http://localhost:8002"
		}

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

	return checks
}
