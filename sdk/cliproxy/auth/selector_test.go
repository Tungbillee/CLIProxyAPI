package auth

import (
	"context"
	"errors"
	"sync"
	"testing"

	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
)

func TestFillFirstSelectorPick_Deterministic(t *testing.T) {
	t.Parallel()

	selector := &FillFirstSelector{}
	auths := []*Auth{
		{ID: "b"},
		{ID: "a"},
		{ID: "c"},
	}

	got, err := selector.Pick(context.Background(), "gemini", "", cliproxyexecutor.Options{}, auths)
	if err != nil {
		t.Fatalf("Pick() error = %v", err)
	}
	if got == nil {
		t.Fatalf("Pick() auth = nil")
	}
	if got.ID != "a" {
		t.Fatalf("Pick() auth.ID = %q, want %q", got.ID, "a")
	}
}

func TestRoundRobinSelectorPick_CyclesDeterministic(t *testing.T) {
	t.Parallel()

	selector := &RoundRobinSelector{}
	auths := []*Auth{
		{ID: "b"},
		{ID: "a"},
		{ID: "c"},
	}

	want := []string{"a", "b", "c", "a", "b"}
	for i, id := range want {
		got, err := selector.Pick(context.Background(), "gemini", "", cliproxyexecutor.Options{}, auths)
		if err != nil {
			t.Fatalf("Pick() #%d error = %v", i, err)
		}
		if got == nil {
			t.Fatalf("Pick() #%d auth = nil", i)
		}
		if got.ID != id {
			t.Fatalf("Pick() #%d auth.ID = %q, want %q", i, got.ID, id)
		}
	}
}

func TestRoundRobinSelectorPick_Concurrent(t *testing.T) {
	selector := &RoundRobinSelector{}
	auths := []*Auth{
		{ID: "b"},
		{ID: "a"},
		{ID: "c"},
	}

	start := make(chan struct{})
	var wg sync.WaitGroup
	errCh := make(chan error, 1)

	goroutines := 32
	iterations := 100
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			for j := 0; j < iterations; j++ {
				got, err := selector.Pick(context.Background(), "gemini", "", cliproxyexecutor.Options{}, auths)
				if err != nil {
					select {
					case errCh <- err:
					default:
					}
					return
				}
				if got == nil {
					select {
					case errCh <- errors.New("Pick() returned nil auth"):
					default:
					}
					return
				}
				if got.ID == "" {
					select {
					case errCh <- errors.New("Pick() returned auth with empty ID"):
					default:
					}
					return
				}
			}
		}()
	}

	close(start)
	wg.Wait()

	select {
	case err := <-errCh:
		t.Fatalf("concurrent Pick() error = %v", err)
	default:
	}
}

func TestConcurrencyAwareSelectorPick_LimitsPerCredential(t *testing.T) {
	t.Parallel()

	selector := NewConcurrencyAwareSelector(2) // max 2 concurrent per credential
	auths := []*Auth{
		{ID: "a"},
		{ID: "b"},
		{ID: "c"},
	}

	// Pick 6 times (2 per credential)
	picks := make([]*Auth, 6)
	for i := 0; i < 6; i++ {
		got, err := selector.Pick(context.Background(), "gemini", "", cliproxyexecutor.Options{}, auths)
		if err != nil {
			t.Fatalf("Pick() #%d error = %v", i, err)
		}
		picks[i] = got
	}

	// Count picks per credential
	counts := make(map[string]int)
	for _, auth := range picks {
		counts[auth.ID]++
	}

	// Each credential should have exactly 2 picks
	for id, count := range counts {
		if count != 2 {
			t.Errorf("credential %s picked %d times, want 2", id, count)
		}
	}

	// 7th pick should fail (all at capacity)
	_, err := selector.Pick(context.Background(), "gemini", "", cliproxyexecutor.Options{}, auths)
	if err == nil {
		t.Fatal("Pick() #7 expected error, got nil")
	}

	// Release one slot
	selector.Release("a")

	// Now should be able to pick again
	got, err := selector.Pick(context.Background(), "gemini", "", cliproxyexecutor.Options{}, auths)
	if err != nil {
		t.Fatalf("Pick() after release error = %v", err)
	}
	if got.ID != "a" {
		t.Errorf("Pick() after release got %s, want a", got.ID)
	}
}

func TestConcurrencyAwareSelectorPick_Concurrent(t *testing.T) {
	selector := NewConcurrencyAwareSelector(2)
	auths := []*Auth{
		{ID: "a"},
		{ID: "b"},
		{ID: "c"},
	}

	start := make(chan struct{})
	var wg sync.WaitGroup
	errCh := make(chan error, 1)
	successCount := make(chan int, 1)

	goroutines := 10
	success := 0
	var mu sync.Mutex

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			got, err := selector.Pick(context.Background(), "gemini", "", cliproxyexecutor.Options{}, auths)
			if err == nil && got != nil {
				mu.Lock()
				success++
				mu.Unlock()
			}
		}()
	}

	close(start)
	wg.Wait()

	// Should have exactly 6 successful picks (3 credentials * 2 max concurrent)
	if success != 6 {
		t.Errorf("concurrent Pick() success = %d, want 6", success)
	}

	close(errCh)
	close(successCount)
}
