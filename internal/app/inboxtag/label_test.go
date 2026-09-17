package inboxtag

import (
	"sort"
	"testing"
)

// Every label a decision can write must be in AllLabels, or it would be created
// one at a time as it first fires and could not be filtered on before that.
// This is the test that keeps labelsFor and AllLabels from drifting apart.
func TestAllLabelsCoversEverythingDecideCanWrite(t *testing.T) {
	all := map[string]bool{}
	for _, l := range AllLabels() {
		all[l] = true
	}

	// Every kind.
	for kind := range kindCriteria {
		if !all[slugOf(kind)] {
			t.Errorf("kind %q is not in AllLabels", kind)
		}
	}
	// Every intent.
	for intent := range intentCriteria {
		if !all[slugOf(intent)] {
			t.Errorf("intent %q is not in AllLabels", intent)
		}
	}
	if !all[LabelNeedsReview] {
		t.Error("needs-review is not in AllLabels")
	}

	// And the signals labelsFor actually surfaces, driven through the real
	// function rather than a second copy of the list.
	d := Decision{
		Kind:    KindHumanReply,
		Intent:  IntentAgreed,
		Signals: SignalIDs(),
	}
	for _, label := range labelsFor(d) {
		if !all[label] {
			t.Errorf("labelsFor emits %q, which AllLabels does not create", label)
		}
	}
}

func TestAllLabelsIsSortedAndUnique(t *testing.T) {
	labels := AllLabels()
	if !sort.StringsAreSorted(labels) {
		t.Error("AllLabels is not sorted, so the filter list order would drift between runs")
	}
	seen := map[string]bool{}
	for _, l := range labels {
		if seen[l] {
			t.Errorf("duplicate label %q", l)
		}
		seen[l] = true
	}
	if len(labels) < 17 {
		t.Errorf("only %d labels; expected the full taxonomy", len(labels))
	}
}
