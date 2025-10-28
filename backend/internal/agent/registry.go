package agent

// SystemRegistry defines which systems are real and can be acted upon by AI agents
type SystemInfo struct {
	Name        string   `json:"name"`
	Actionable  bool     `json:"actionable"` // Can agents take actions on this system?
	Description string   `json:"description"`
	Actions     []string `json:"actions"` // Available remediation actions
}

// ActionableSystems is the registry of all systems in the platform
var ActionableSystems = map[string]SystemInfo{
	// Real systems that agents can interact with
	"redis-test": {
		Name:        "redis-test",
		Actionable:  true,
		Description: "Mock Redis instance for testing agent actions",
		Actions:     []string{"clear_cache", "restart", "adjust_memory_limit"},
	},
	"health-monitor": {
		Name:        "health-monitor",
		Actionable:  true,
		Description: "System health monitoring service",
		Actions:     []string{"reset_thresholds", "clear_alerts"},
	},
	"postgres-test": {
		Name:        "postgres-test",
		Actionable:  true,
		Description: "Mock PostgreSQL instance for testing agent actions",
		Actions:     []string{"kill_idle_connections", "vacuum_table", "restart"},
	},
	"disk-monitor": {
		Name:        "disk-monitor",
		Actionable:  true,
		Description: "Disk space monitoring and cleanup",
		Actions:     []string{"cleanup_old_logs", "restart"},
	},

	// Synthetic systems from incident generator (NOT actionable)
	"api-gateway": {
		Name:        "api-gateway",
		Actionable:  false,
		Description: "Generated scenario - no real system",
		Actions:     []string{},
	},
	"payment-gateway": {
		Name:        "payment-gateway",
		Actionable:  false,
		Description: "Generated scenario - no real system",
		Actions:     []string{},
	},
	"billing-service": {
		Name:        "billing-service",
		Actionable:  false,
		Description: "Generated scenario - no real system",
		Actions:     []string{},
	},
	"user-service": {
		Name:        "user-service",
		Actionable:  false,
		Description: "Generated scenario - no real system",
		Actions:     []string{},
	},
	"cloudflare-cdn": {
		Name:        "cloudflare-cdn",
		Actionable:  false,
		Description: "Generated scenario - no real system",
		Actions:     []string{},
	},
	"email-relay-service": {
		Name:        "email-relay-service",
		Actionable:  false,
		Description: "Generated scenario - no real system",
		Actions:     []string{},
	},
	"edge-cdn": {
		Name:        "edge-cdn",
		Actionable:  false,
		Description: "Generated scenario - no real system",
		Actions:     []string{},
	},
	"data-pipeline-processor": {
		Name:        "data-pipeline-processor",
		Actionable:  false,
		Description: "Generated scenario - no real system",
		Actions:     []string{},
	},
	"analytics-data-pipeline": {
		Name:        "analytics-data-pipeline",
		Actionable:  false,
		Description: "Generated scenario - no real system",
		Actions:     []string{},
	},
}

// IsSystemActionable checks if a system can be acted upon by agents
func IsSystemActionable(systemName string) bool {
	if info, exists := ActionableSystems[systemName]; exists {
		return info.Actionable
	}
	return false
}

// GetSystemInfo returns information about a system
func GetSystemInfo(systemName string) (SystemInfo, bool) {
	info, exists := ActionableSystems[systemName]
	return info, exists
}

// GetAllActionableSystems returns a list of all systems that agents can act on
func GetAllActionableSystems() []SystemInfo {
	var systems []SystemInfo
	for _, info := range ActionableSystems {
		if info.Actionable {
			systems = append(systems, info)
		}
	}
	return systems
}

// RegisterSystem adds a new system to the registry (useful for dynamic systems)
func RegisterSystem(info SystemInfo) {
	ActionableSystems[info.Name] = info
}
