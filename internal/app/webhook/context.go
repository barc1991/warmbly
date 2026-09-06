package webhook

import "context"

// AutomationDepthKey is the internal event-data key carrying how many automation
// hops led to an event. Underscore-prefixed so it is stripped from customer
// deliveries and cannot be set by an inbound webhook body.
const AutomationDepthKey = "_automation_depth"

type automationDepthCtxKey struct{}

// WithAutomationDepth marks a context as running inside an automation action,
// depth hops down from the original event. Events dispatched under it carry the
// depth so a flow that creates a contact cannot re-trigger itself forever.
func WithAutomationDepth(ctx context.Context, depth int) context.Context {
	if depth <= 0 {
		return ctx
	}
	return context.WithValue(ctx, automationDepthCtxKey{}, depth)
}

// AutomationDepth reports the automation depth carried by ctx, 0 outside one.
func AutomationDepth(ctx context.Context) int {
	if d, ok := ctx.Value(automationDepthCtxKey{}).(int); ok && d > 0 {
		return d
	}
	return 0
}

// stampAutomationDepth returns a copy of a map payload carrying the context's
// automation depth, or the payload unchanged when there is no depth to carry.
// The copy keeps the caller's map (and the customer webhook body) untouched.
func stampAutomationDepth(ctx context.Context, data any) any {
	depth := AutomationDepth(ctx)
	if depth == 0 {
		return data
	}
	m, ok := data.(map[string]any)
	if !ok {
		return data
	}
	out := make(map[string]any, len(m)+1)
	for k, v := range m {
		out[k] = v
	}
	out[AutomationDepthKey] = float64(depth)
	return out
}
