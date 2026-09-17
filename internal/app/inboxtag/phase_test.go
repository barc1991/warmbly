package inboxtag

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strings"
	"testing"
)

// PHASE 1 BOUNDARY.
//
// This phase writes labels and a relevance score. It does not snooze, hold a
// lead, create a task, or suppress an address. That is not a limitation to be
// worked around, it is the deployment plan: labels are reversible and visible,
// suppression is neither. Wrongly suppressing a lead is silent and permanent,
// and it is the one mistake here nobody ever finds out about.
//
// A comment saying so would be ignored the first time someone was in a hurry,
// so the boundary is a test. If this fails because you added one of these
// calls, you are starting phase 2, and this test is the first thing to change,
// deliberately, in its own pull request.
func TestPhaseOneReachesNoActionPrimitives(t *testing.T) {
	forbidden := map[string]string{
		"SnoozeThread":    "phase 2",
		"Snooze":          "phase 2",
		"SetLeadHold":     "phase 2",
		"LeadHold":        "phase 2",
		"CreateTask":      "phase 2",
		"AddSuppressions": "phase 3",
		"Suppress":        "phase 3",
		"MoveFolder":      "phase 2",
	}

	fset := token.NewFileSet()
	entries, err := os.ReadDir(".")
	if err != nil {
		t.Fatalf("read package dir: %v", err)
	}

	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}
		file, err := parser.ParseFile(fset, name, nil, 0)
		if err != nil {
			t.Fatalf("parse %s: %v", name, err)
		}

		ast.Inspect(file, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			sel, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			if phase, bad := forbidden[sel.Sel.Name]; bad {
				t.Errorf("%s:%d calls %s, which belongs to %s. Phase 1 writes labels only.",
					name, fset.Position(call.Pos()).Line, sel.Sel.Name, phase)
			}
			return true
		})
	}
}

// The service's only declared capability beyond reading and storing is applying
// labels. If a new interface appears on it, that is the moment to ask which
// phase it belongs to.
func TestServiceCapabilitiesAreLabelsOnly(t *testing.T) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "service.go", nil, 0)
	if err != nil {
		t.Fatalf("parse service.go: %v", err)
	}

	// Capabilities, plus bookkeeping that carries none. seeded/seededMu only
	// remember which workspaces already have the label rows created; they reach
	// nothing the categories capability does not already reach.
	allowed := map[string]bool{
		"asker": true, "repo": true, "categories": true, "mailboxes": true, "enabled": true,
		"seeded": true, "seededMu": true,
	}

	ast.Inspect(file, func(n ast.Node) bool {
		ts, ok := n.(*ast.TypeSpec)
		if !ok || ts.Name.Name != "Service" {
			return true
		}
		st, ok := ts.Type.(*ast.StructType)
		if !ok {
			return true
		}
		for _, f := range st.Fields.List {
			for _, fieldName := range f.Names {
				if !allowed[fieldName.Name] {
					t.Errorf("Service gained field %q. Phase 1 has no capability beyond labels; "+
						"if this is a phase-2 action, it belongs in its own PR.", fieldName.Name)
				}
			}
		}
		return false
	})
}
