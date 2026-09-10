package generation

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	"google.golang.org/genai"
)

// Gemini model identifiers
const (
	GeminiModel38Flash     = "gemini-3.8-flash"
	GeminiModel37Flash     = "gemini-3.7-flash"
	GeminiModel36Flash     = "gemini-3.6-flash"
	GeminiModel35FlashLite = "gemini-3.5-flash-lite"

	GeminiModelPrimary = GeminiModel38Flash
)

// DefaultGeminiFallbackChain defines the fallback cascade ordered from best to fastest/lightest.
var DefaultGeminiFallbackChain = []string{
	GeminiModel38Flash,
	GeminiModel37Flash,
	GeminiModel36Flash,
	GeminiModel35FlashLite,
}

var (
	_ Provider         = (*geminiProvider)(nil)
	_ WritingGenerator = (*geminiProvider)(nil)
)

type geminiProvider struct {
	rotator         *GeminiKeyRotator
	primaryModel    string
	fallbackChain   []string
	fallbackEnabled bool

	clientsMu sync.RWMutex
	clients   map[string]*genai.Client
}

// newGeminiProvider constructs a Gemini provider backed by a key rotator and smart fallback.
func newGeminiProvider(cfg ProviderConfig) *geminiProvider {
	rotator := cfg.GeminiRotator
	if rotator == nil {
		rotator = NewGeminiKeyRotator()
		if cfg.GeminiAPIKey != "" {
			rotator.AddKey(cfg.GeminiAPIKey)
		}
		for _, k := range cfg.GeminiKeys {
			rotator.AddKey(k)
		}
	}

	primary := cfg.GeminiPrimaryModel
	if strings.TrimSpace(primary) == "" {
		primary = GeminiModelPrimary
	}

	fallbackChain := cfg.GeminiFallbackChain
	if len(fallbackChain) == 0 {
		fallbackChain = DefaultGeminiFallbackChain
	}

	return &geminiProvider{
		rotator:         rotator,
		primaryModel:    primary,
		fallbackChain:   fallbackChain,
		fallbackEnabled: true,
		clients:         make(map[string]*genai.Client),
	}
}

func (p *geminiProvider) Name() string {
	return "gemini"
}

func (p *geminiProvider) IsLocal() bool {
	return false
}

func (p *geminiProvider) ModelForTier(paid bool) string {
	if paid {
		return GeminiModel38Flash
	}
	return GeminiModel37Flash
}

// Rotator returns the underlying key rotator.
func (p *geminiProvider) Rotator() *GeminiKeyRotator {
	return p.rotator
}

func (p *geminiProvider) getClient(ctx context.Context, apiKey string) (*genai.Client, error) {
	p.clientsMu.RLock()
	c, ok := p.clients[apiKey]
	p.clientsMu.RUnlock()
	if ok {
		return c, nil
	}

	p.clientsMu.Lock()
	defer p.clientsMu.Unlock()
	if c, ok := p.clients[apiKey]; ok {
		return c, nil
	}

	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("gemini: create client: %w", err)
	}
	p.clients[apiKey] = client
	return client, nil
}

// modelsToAttempt returns the sequence of models to try given an initial request model.
func (p *geminiProvider) modelsToAttempt(requestedModel string) []string {
	start := requestedModel
	if strings.TrimSpace(start) == "" {
		start = p.primaryModel
	}

	if !p.fallbackEnabled {
		return []string{start}
	}

	chain := make([]string, 0, len(p.fallbackChain)+1)
	chain = append(chain, start)

	for _, m := range p.fallbackChain {
		if m != start {
			chain = append(chain, m)
		}
	}
	return chain
}

// generateWithFallback attempts generation across available keys and cascading fallback models.
func (p *geminiProvider) generateWithFallback(
	ctx context.Context,
	models []string,
	contents []*genai.Content,
	config *genai.GenerateContentConfig,
) (*genai.GenerateContentResponse, string, error) {
	keyCount := p.rotator.KeyCount()
	if keyCount == 0 {
		return nil, "", errors.New("gemini: no API keys configured in rotator")
	}

	var lastErr error

	for _, model := range models {
		// Try up to keyCount attempts on the current model
		maxAttempts := keyCount
		if maxAttempts < 2 {
			maxAttempts = 2
		}

		modelOverloaded := false

		for attempt := 0; attempt < maxAttempts; attempt++ {
			key, ok := p.rotator.GetKey()
			if !ok {
				break
			}

			client, err := p.getClient(ctx, key)
			if err != nil {
				p.rotator.MarkFailed(key, err)
				lastErr = err
				continue
			}

			resp, err := client.Models.GenerateContent(ctx, model, contents, config)
			if err == nil {
				p.rotator.MarkSuccess(key)
				return resp, model, nil
			}

			// Generation failed: mark key failure and inspect error
			p.rotator.MarkFailed(key, err)
			lastErr = err

			errType := ClassifyError(err)
			if errType == GeminiErrModelOverload || errType == GeminiErrModelNotFound {
				// Model itself is overloaded, unavailable, or not found: switch to fallback model immediately!
				modelOverloaded = true
				break
			}
			// If rate limited or quota exceeded, loop will pick the next available key for this model
		}

		if !p.fallbackEnabled && !modelOverloaded {
			break
		}
	}

	return nil, "", fmt.Errorf("gemini: all keys and fallback models failed: %w", lastErr)
}

// transcriptToGemini converts provider-agnostic AgentMessages into Google GenAI Contents.
func transcriptToGemini(msgs []AgentMessage) ([]*genai.Content, error) {
	// Pre-index tool names by ToolCallID for matching function responses
	toolNameByID := make(map[string]string)
	for _, m := range msgs {
		for _, tc := range m.ToolCalls {
			toolNameByID[tc.ID] = tc.Name
		}
	}

	var contents []*genai.Content
	var pendingFuncResponses []*genai.Part

	flushFuncResponses := func() {
		if len(pendingFuncResponses) > 0 {
			contents = append(contents, &genai.Content{
				Role:  "user",
				Parts: pendingFuncResponses,
			})
			pendingFuncResponses = nil
		}
	}

	for _, m := range msgs {
		switch m.Role {
		case "tool":
			name := toolNameByID[m.ToolCallID]
			if name == "" {
				name = "tool_result"
			}
			var respMap map[string]any
			if err := json.Unmarshal([]byte(m.Content), &respMap); err != nil {
				respMap = map[string]any{"result": m.Content}
			}
			part := genai.NewPartFromFunctionResponse(name, respMap)
			if part.FunctionResponse != nil {
				part.FunctionResponse.ID = m.ToolCallID
			}
			pendingFuncResponses = append(pendingFuncResponses, part)

		case "assistant":
			flushFuncResponses()
			var parts []*genai.Part
			if strings.TrimSpace(m.Content) != "" {
				parts = append(parts, genai.NewPartFromText(m.Content))
			}
			for _, tc := range m.ToolCalls {
				var argsMap map[string]any
				if len(tc.Args) > 0 {
					_ = json.Unmarshal(tc.Args, &argsMap)
				}
				part := genai.NewPartFromFunctionCall(tc.Name, argsMap)
				if part.FunctionCall != nil {
					part.FunctionCall.ID = tc.ID
				}
				parts = append(parts, part)
			}
			contents = append(contents, &genai.Content{
				Role:  "model",
				Parts: parts,
			})

		default: // "user"
			flushFuncResponses()
			contents = append(contents, &genai.Content{
				Role:  "user",
				Parts: []*genai.Part{genai.NewPartFromText(m.Content)},
			})
		}
	}

	flushFuncResponses()
	return contents, nil
}

func geminiToolsFromDefs(tools []ToolDef) []*genai.Tool {
	if len(tools) == 0 {
		return nil
	}
	decls := make([]*genai.FunctionDeclaration, 0, len(tools))
	for _, t := range tools {
		decls = append(decls, &genai.FunctionDeclaration{
			Name:                 t.Name,
			Description:          t.Description,
			ParametersJsonSchema: t.InputSchema,
		})
	}
	return []*genai.Tool{{FunctionDeclarations: decls}}
}

// Complete runs a single tool-less completion with an explicit system prompt.
func (p *geminiProvider) Complete(ctx context.Context, req CompletionRequest) (*WritingResult, error) {
	if p.rotator.KeyCount() == 0 {
		return nil, ErrNotConfigured
	}

	models := p.modelsToAttempt(req.Model)
	contents := []*genai.Content{
		{
			Role:  "user",
			Parts: []*genai.Part{genai.NewPartFromText(req.Prompt)},
		},
	}

	config := &genai.GenerateContentConfig{}
	if req.System != "" {
		config.SystemInstruction = genai.NewContentFromText(req.System, "")
	}
	if req.MaxTokens > 0 {
		config.MaxOutputTokens = int32(req.MaxTokens)
	}
	if req.Temperature != nil {
		t := float32(*req.Temperature)
		config.Temperature = &t
	}

	resp, usedModel, err := p.generateWithFallback(ctx, models, contents, config)
	if err != nil {
		return nil, err
	}

	text := strings.TrimSpace(resp.Text())
	if text == "" {
		return nil, errors.New("gemini: empty completion response")
	}

	tokens := 0
	if resp.UsageMetadata != nil {
		tokens = int(resp.UsageMetadata.TotalTokenCount)
	}

	return &WritingResult{
		Text:       text,
		Model:      usedModel,
		TokensUsed: tokens,
	}, nil
}

// RunAgent implements the tool-use loop against Gemini with multi-key rotation and cascading fallback.
func (p *geminiProvider) RunAgent(ctx context.Context, req AgentRequest) (*AgentResult, error) {
	if p.rotator.KeyCount() == 0 {
		return nil, ErrNotConfigured
	}

	models := p.modelsToAttempt(req.Model)
	activeModel := models[0]

	maxIter := req.MaxIterations
	if maxIter <= 0 {
		maxIter = defaultMaxIterations
	}
	maxTokens := req.MaxTokens
	if maxTokens <= 0 {
		maxTokens = defaultAgentTokens
	}

	byName := make(map[string]ToolDef, len(req.Tools))
	for _, t := range req.Tools {
		byName[t.Name] = t
	}

	tools := geminiToolsFromDefs(req.Tools)
	messages := append([]AgentMessage(nil), req.Messages...)
	result := &AgentResult{Model: activeModel}

	for iter := 0; iter < maxIter; iter++ {
		if req.PreIteration != nil {
			if err := req.PreIteration(ctx, iter+1); err != nil {
				result.Messages = messages
				result.StopReason = "stopped"
				return result, nil
			}
		}
		result.Iterations++
		if req.OnEvent != nil {
			req.OnEvent(AgentEvent{Type: EventIteration, Iteration: result.Iterations})
		}

		contents, err := transcriptToGemini(messages)
		if err != nil {
			return nil, fmt.Errorf("gemini: convert transcript: %w", err)
		}

		config := &genai.GenerateContentConfig{
			Tools:           tools,
			MaxOutputTokens: int32(maxTokens),
		}
		if req.System != "" {
			config.SystemInstruction = genai.NewContentFromText(req.System, "")
		}

		resp, usedModel, err := p.generateWithFallback(ctx, models, contents, config)
		if err != nil {
			return nil, err
		}

		result.Model = usedModel
		if resp.UsageMetadata != nil {
			result.TokensUsed += int(resp.UsageMetadata.TotalTokenCount)
		}

		respText := strings.TrimSpace(resp.Text())
		fnCalls := resp.FunctionCalls()

		// If no tools were called, this is the final assistant turn.
		if len(fnCalls) == 0 {
			if respText == "" {
				respText = "No response generated."
			}
			messages = append(messages, AgentMessage{
				Role:    "assistant",
				Content: respText,
			})
			result.Text = respText
			result.Messages = messages
			result.StopReason = "stop"
			return result, nil
		}

		// Model called tools: build tool calls slice
		toolCalls := make([]ToolCall, 0, len(fnCalls))
		for idx, fc := range fnCalls {
			argsBytes, err := json.Marshal(fc.Args)
			if err != nil {
				argsBytes = []byte("{}")
			}
			id := fc.ID
			if id == "" {
				id = fmt.Sprintf("call_%d_%d", iter, idx)
			}
			toolCalls = append(toolCalls, ToolCall{
				ID:   id,
				Name: fc.Name,
				Args: argsBytes,
			})
		}

		// Record assistant message with tool calls
		messages = append(messages, AgentMessage{
			Role:      "assistant",
			Content:   respText,
			ToolCalls: toolCalls,
		})

		// Execute each tool call
		for _, call := range toolCalls {
			toolDef, exists := byName[call.Name]
			if !exists {
				messages = append(messages, AgentMessage{
					Role:       "tool",
					ToolCallID: call.ID,
					Content:    fmt.Sprintf("error: unknown tool %q", call.Name),
				})
				continue
			}

			// Approval check for write/send tools
			if toolDef.Risk != RiskRead && req.Approve != nil {
				if err := req.Approve(ctx, toolDef, call); err != nil {
					if errors.Is(err, ErrApprovalRequired) {
						result.Messages = messages
						result.StopReason = "approval_required"
						result.Pending = &PendingToolCall{Call: call, Risk: toolDef.Risk}
						return result, nil
					}
					return nil, err
				}
			}

			if req.OnEvent != nil {
				req.OnEvent(AgentEvent{
					Type:      EventToolStart,
					ToolName:  call.Name,
					ToolArgs:  call.Args,
					Iteration: result.Iterations,
				})
			}

			outStr, toolErr := toolDef.Handler(ctx, call.Args)
			if toolErr != nil {
				outStr = fmt.Sprintf("error: %v", toolErr)
			}

			if req.OnEvent != nil {
				req.OnEvent(AgentEvent{
					Type:       EventToolResult,
					ToolName:   call.Name,
					ToolResult: outStr,
					Iteration:  result.Iterations,
				})
			}

			messages = append(messages, AgentMessage{
				Role:       "tool",
				ToolCallID: call.ID,
				Content:    outStr,
			})
		}
	}

	result.Messages = messages
	result.StopReason = "max_iterations"
	return result, nil
}

// GenerateWriting implements WritingGenerator for email generation and voice adaptation.
func (p *geminiProvider) GenerateWriting(ctx context.Context, model, prompt string, voice VoiceContext) (*WritingResult, error) {
	if p == nil || p.rotator.KeyCount() == 0 {
		return nil, ErrNotConfigured
	}
	targetModel := model
	if targetModel == "" {
		targetModel = p.primaryModel
	}
	return p.Complete(ctx, CompletionRequest{
		System: BuildVoiceRules(voice),
		Prompt: prompt,
		Model:  targetModel,
	})
}
