package serper

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var (
	ErrRateLimit        = errors.New("serper rate limit exceeded (429)")
	ErrCreditsExhausted = errors.New("serper credits exhausted or unauthorized (403)")
	ErrInvalidKey       = errors.New("serper key is invalid")
	ErrSearchFailed     = errors.New("serper search request failed")
)

const (
	serperURL     = "https://google.serper.dev/search"
	searchTimeout = 10 * time.Second
)

// OrganicResult represents an organic Google search hit.
type OrganicResult struct {
	Title    string `json:"title"`
	Link     string `json:"link"`
	Snippet  string `json:"snippet"`
	Position int    `json:"position,omitempty"`
}

// AdResult represents a Google search ad hit.
type AdResult struct {
	Title   string `json:"title"`
	Link    string `json:"link"`
	Snippet string `json:"snippet"`
}

// SearchResponse is the structured result returned by Serper.
type SearchResponse struct {
	Organic []OrganicResult `json:"organic"`
	Ads     []AdResult      `json:"ads,omitempty"`
	Credits int             `json:"credits,omitempty"`
}

// Client executes queries against Serper API.
type Client struct {
	httpClient *http.Client
}

// NewClient returns a Serper client with sensible HTTP timeout.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: searchTimeout,
		},
	}
}

// Search executes a Google query via Serper.
func (c *Client) Search(ctx context.Context, apiKey, query string, num int) (*SearchResponse, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, ErrInvalidKey
	}
	if strings.TrimSpace(query) == "" {
		return nil, errors.New("search query is empty")
	}
	if num <= 0 {
		num = 10
	}
	if num > 20 {
		num = 20
	}

	payload := map[string]any{
		"q":   query,
		"num": num,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, serperURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-API-KEY", strings.TrimSpace(apiKey))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSearchFailed, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, ErrRateLimit
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, ErrCreditsExhausted
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%w (status %d): %s", ErrSearchFailed, resp.StatusCode, string(respBody))
	}

	var raw struct {
		Organic []struct {
			Title    string `json:"title"`
			Link     string `json:"link"`
			Snippet  string `json:"snippet"`
			Position int    `json:"position"`
		} `json:"organic"`
		Ads []struct {
			Title   string `json:"title"`
			Link    string `json:"link"`
			Snippet string `json:"snippet"`
		} `json:"ads"`
		Credits int    `json:"credits"`
		Message string `json:"message"`
	}

	if err := json.Unmarshal(respBody, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse serper response: %w", err)
	}

	if strings.Contains(strings.ToLower(raw.Message), "not enough credits") {
		return nil, ErrCreditsExhausted
	}

	res := &SearchResponse{
		Credits: raw.Credits,
	}
	for _, o := range raw.Organic {
		res.Organic = append(res.Organic, OrganicResult{
			Title:    o.Title,
			Link:     o.Link,
			Snippet:  o.Snippet,
			Position: o.Position,
		})
	}
	for _, a := range raw.Ads {
		res.Ads = append(res.Ads, AdResult{
			Title:   a.Title,
			Link:    a.Link,
			Snippet: a.Snippet,
		})
	}

	return res, nil
}

// TestKey verifies key connectivity with a minimal test search.
func (c *Client) TestKey(ctx context.Context, apiKey string) (bool, int64, string, error) {
	start := time.Now()
	res, err := c.Search(ctx, apiKey, "test", 1)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return false, latency, "", err
	}
	info := fmt.Sprintf("%d organic results returned", len(res.Organic))
	return true, latency, info, nil
}
