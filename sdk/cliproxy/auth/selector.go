package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"

	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
	log "github.com/sirupsen/logrus"
)

// RoundRobinSelector provides a simple provider scoped round-robin selection strategy.
type RoundRobinSelector struct {
	mu      sync.Mutex
	cursors map[string]int
}

// FillFirstSelector selects the first available credential (deterministic ordering).
// This "burns" one account before moving to the next, which can help stagger
// rolling-window subscription caps (e.g. chat message limits).
type FillFirstSelector struct{}

// ConcurrencyAwareSelector extends round-robin with per-credential concurrency limits.
// It prevents rate limiting by tracking active requests per credential and selecting
// credentials with available capacity.
type ConcurrencyAwareSelector struct {
	mu            sync.Mutex
	cursors       map[string]int
	activeCount   map[string]int           // authID -> current active requests
	maxConcurrent int                      // max concurrent requests per credential
	waitTimeout   time.Duration            // timeout for waiting when all at capacity
}

// NewConcurrencyAwareSelector creates a selector that limits concurrent requests per credential.
// maxConcurrent: max parallel requests per credential (default: 2 for Gemini/Antigravity free tier)
func NewConcurrencyAwareSelector(maxConcurrent int) *ConcurrencyAwareSelector {
	if maxConcurrent <= 0 {
		maxConcurrent = 2
	}
	return &ConcurrencyAwareSelector{
		cursors:       make(map[string]int),
		activeCount:   make(map[string]int),
		maxConcurrent: maxConcurrent,
		waitTimeout:   5 * time.Second,
	}
}

// Pick selects the next available auth with capacity for concurrent requests.
// It prioritizes credentials with fewer active requests.
func (s *ConcurrencyAwareSelector) Pick(ctx context.Context, provider, model string, opts cliproxyexecutor.Options, auths []*Auth) (*Auth, error) {
	_ = opts
	now := time.Now()
	available, err := getAvailableAuths(auths, provider, model, now)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cursors == nil {
		s.cursors = make(map[string]int)
	}
	if s.activeCount == nil {
		s.activeCount = make(map[string]int)
	}

	// Sort by active count (least loaded first), then by ID for stability
	sorted := make([]*Auth, len(available))
	copy(sorted, available)
	sort.Slice(sorted, func(i, j int) bool {
		countI := s.activeCount[sorted[i].ID]
		countJ := s.activeCount[sorted[j].ID]
		if countI != countJ {
			return countI < countJ
		}
		return sorted[i].ID < sorted[j].ID
	})

	// Find first credential with capacity
	for _, auth := range sorted {
		if s.activeCount[auth.ID] < s.maxConcurrent {
			s.activeCount[auth.ID]++
			log.Debugf("[ConcurrencyAwareSelector] Picked auth %s (active: %d/%d, total available: %d)",
				auth.ID, s.activeCount[auth.ID], s.maxConcurrent, len(available))
			return auth, nil
		}
	}

	// All credentials at capacity - return rate limit error
	return nil, newModelCooldownError(model, provider, s.waitTimeout)
}

// Release decrements the active count for a credential after request completes.
// Must be called after each successful Pick to free up capacity.
func (s *ConcurrencyAwareSelector) Release(authID string) {
	if authID == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.activeCount == nil {
		return
	}
	if count, ok := s.activeCount[authID]; ok && count > 0 {
		s.activeCount[authID] = count - 1
	}
}

// ActiveCount returns the current active request count for a credential.
func (s *ConcurrencyAwareSelector) ActiveCount(authID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.activeCount == nil {
		return 0
	}
	return s.activeCount[authID]
}

// TotalActive returns the total active requests across all credentials.
func (s *ConcurrencyAwareSelector) TotalActive() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	total := 0
	for _, count := range s.activeCount {
		total += count
	}
	return total
}

type blockReason int

const (
	blockReasonNone blockReason = iota
	blockReasonCooldown
	blockReasonDisabled
	blockReasonOther
)

type modelCooldownError struct {
	model    string
	resetIn  time.Duration
	provider string
}

func newModelCooldownError(model, provider string, resetIn time.Duration) *modelCooldownError {
	if resetIn < 0 {
		resetIn = 0
	}
	return &modelCooldownError{
		model:    model,
		provider: provider,
		resetIn:  resetIn,
	}
}

func (e *modelCooldownError) Error() string {
	modelName := e.model
	if modelName == "" {
		modelName = "requested model"
	}
	message := fmt.Sprintf("All credentials for model %s are cooling down", modelName)
	if e.provider != "" {
		message = fmt.Sprintf("%s via provider %s", message, e.provider)
	}
	resetSeconds := int(math.Ceil(e.resetIn.Seconds()))
	if resetSeconds < 0 {
		resetSeconds = 0
	}
	displayDuration := e.resetIn
	if displayDuration > 0 && displayDuration < time.Second {
		displayDuration = time.Second
	} else {
		displayDuration = displayDuration.Round(time.Second)
	}
	errorBody := map[string]any{
		"code":          "model_cooldown",
		"message":       message,
		"model":         e.model,
		"reset_time":    displayDuration.String(),
		"reset_seconds": resetSeconds,
	}
	if e.provider != "" {
		errorBody["provider"] = e.provider
	}
	payload := map[string]any{"error": errorBody}
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Sprintf(`{"error":{"code":"model_cooldown","message":"%s"}}`, message)
	}
	return string(data)
}

func (e *modelCooldownError) StatusCode() int {
	return http.StatusTooManyRequests
}

func (e *modelCooldownError) Headers() http.Header {
	headers := make(http.Header)
	headers.Set("Content-Type", "application/json")
	resetSeconds := int(math.Ceil(e.resetIn.Seconds()))
	if resetSeconds < 0 {
		resetSeconds = 0
	}
	headers.Set("Retry-After", strconv.Itoa(resetSeconds))
	return headers
}

func collectAvailable(auths []*Auth, model string, now time.Time) (available []*Auth, cooldownCount int, earliest time.Time) {
	available = make([]*Auth, 0, len(auths))
	for i := 0; i < len(auths); i++ {
		candidate := auths[i]
		blocked, reason, next := isAuthBlockedForModel(candidate, model, now)
		if !blocked {
			available = append(available, candidate)
			continue
		}
		if reason == blockReasonCooldown {
			cooldownCount++
			if !next.IsZero() && (earliest.IsZero() || next.Before(earliest)) {
				earliest = next
			}
		}
	}
	if len(available) > 1 {
		sort.Slice(available, func(i, j int) bool { return available[i].ID < available[j].ID })
	}
	return available, cooldownCount, earliest
}

func getAvailableAuths(auths []*Auth, provider, model string, now time.Time) ([]*Auth, error) {
	if len(auths) == 0 {
		return nil, &Error{Code: "auth_not_found", Message: "no auth candidates"}
	}

	available, cooldownCount, earliest := collectAvailable(auths, model, now)
	if len(available) == 0 {
		if cooldownCount == len(auths) && !earliest.IsZero() {
			resetIn := earliest.Sub(now)
			if resetIn < 0 {
				resetIn = 0
			}
			return nil, newModelCooldownError(model, provider, resetIn)
		}
		return nil, &Error{Code: "auth_unavailable", Message: "no auth available"}
	}

	return available, nil
}

// Pick selects the next available auth for the provider in a round-robin manner.
func (s *RoundRobinSelector) Pick(ctx context.Context, provider, model string, opts cliproxyexecutor.Options, auths []*Auth) (*Auth, error) {
	_ = ctx
	_ = opts
	now := time.Now()
	available, err := getAvailableAuths(auths, provider, model, now)
	if err != nil {
		return nil, err
	}
	key := provider + ":" + model
	s.mu.Lock()
	if s.cursors == nil {
		s.cursors = make(map[string]int)
	}
	index := s.cursors[key]

	if index >= 2_147_483_640 {
		index = 0
	}

	s.cursors[key] = index + 1
	s.mu.Unlock()
	// log.Debugf("available: %d, index: %d, key: %d", len(available), index, index%len(available))
	return available[index%len(available)], nil
}

// Pick selects the first available auth for the provider in a deterministic manner.
func (s *FillFirstSelector) Pick(ctx context.Context, provider, model string, opts cliproxyexecutor.Options, auths []*Auth) (*Auth, error) {
	_ = ctx
	_ = opts
	now := time.Now()
	available, err := getAvailableAuths(auths, provider, model, now)
	if err != nil {
		return nil, err
	}
	return available[0], nil
}

func isAuthBlockedForModel(auth *Auth, model string, now time.Time) (bool, blockReason, time.Time) {
	if auth == nil {
		return true, blockReasonOther, time.Time{}
	}
	if auth.Disabled || auth.Status == StatusDisabled {
		return true, blockReasonDisabled, time.Time{}
	}
	if model != "" {
		if len(auth.ModelStates) > 0 {
			if state, ok := auth.ModelStates[model]; ok && state != nil {
				if state.Status == StatusDisabled {
					return true, blockReasonDisabled, time.Time{}
				}
				if state.Unavailable {
					if state.NextRetryAfter.IsZero() {
						return false, blockReasonNone, time.Time{}
					}
					if state.NextRetryAfter.After(now) {
						next := state.NextRetryAfter
						if !state.Quota.NextRecoverAt.IsZero() && state.Quota.NextRecoverAt.After(now) {
							next = state.Quota.NextRecoverAt
						}
						if next.Before(now) {
							next = now
						}
						if state.Quota.Exceeded {
							return true, blockReasonCooldown, next
						}
						return true, blockReasonOther, next
					}
				}
				return false, blockReasonNone, time.Time{}
			}
		}
		return false, blockReasonNone, time.Time{}
	}
	if auth.Unavailable && auth.NextRetryAfter.After(now) {
		next := auth.NextRetryAfter
		if !auth.Quota.NextRecoverAt.IsZero() && auth.Quota.NextRecoverAt.After(now) {
			next = auth.Quota.NextRecoverAt
		}
		if next.Before(now) {
			next = now
		}
		if auth.Quota.Exceeded {
			return true, blockReasonCooldown, next
		}
		return true, blockReasonOther, next
	}
	return false, blockReasonNone, time.Time{}
}
