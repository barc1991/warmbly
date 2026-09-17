package repository

import "testing"

// prefixTSQuery builds a tsquery from whatever lands in a search box, so the
// cases that matter are the hostile ones: to_tsquery is a parser and raises on
// syntax it cannot read, which would turn a stray bracket into a 500.
func TestPrefixTSQuery(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"single word", "dyno", "dyno:*"},
		{"two words are ANDed", "quick collab", "quick:* & collab:*"},
		{"lowercased", "DynoWeb", "dynoweb:*"},
		{"an address splits into its parts", "suman@mail.dynoweb.app", "suman:* & mail:* & dynoweb:* & app:*"},

		// Every one of these makes to_tsquery raise when passed through raw.
		{"operators are stripped", "a & b | c", "a:* & b:* & c:*"},
		{"unbalanced bracket", "re: (urgent", "re:* & urgent:*"},
		{"negation and colons", "!foo:bar", "foo:* & bar:*"},
		{"quotes", `"exact phrase"`, "exact:* & phrase:*"},
		{"a lone operator has nothing to search", "&&&", ""},

		{"empty", "", ""},
		{"whitespace only", "   \t ", ""},
		{"digits are kept", "invoice 2026", "invoice:* & 2026:*"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := prefixTSQuery(tc.input); got != tc.want {
				t.Fatalf("prefixTSQuery(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

// A pasted paragraph must not become a 200-term query the planner has to walk.
func TestPrefixTSQueryCapsTerms(t *testing.T) {
	got := prefixTSQuery("one two three four five six seven eight nine ten eleven")
	want := "one:* & two:* & three:* & four:* & five:* & six:* & seven:* & eight:*"
	if got != want {
		t.Fatalf("prefixTSQuery capped = %q, want %q", got, want)
	}
}
