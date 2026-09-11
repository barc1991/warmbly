package emailverify

import (
	"testing"
)

func TestSuggestDomain(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		// Correct domains (should yield empty string)
		{"gmail.com", ""},
		{"googlemail.com", ""},
		{"outlook.com", ""},
		{"hotmail.com", ""},
		{"yahoo.com", ""},
		{"walla.co.il", ""},
		{"customcompany.com", ""},

		// Gmail typos
		{"gmai.com", "gmail.com"},
		{"gmil.com", "gmail.com"},
		{"gmali.com", "gmail.com"},
		{"gmail.con", "gmail.com"},
		{"gmail.cmo", "gmail.com"},
		{"gmail.co", "gmail.com"},
		{"gmaill.com", "gmail.com"},
		{"gmaik.com", "gmail.com"},
		{"fmail.com", "gmail.com"},

		// Outlook & Hotmail typos
		{"outlok.com", "outlook.com"},
		{"outloo.com", "outlook.com"},
		{"hotmial.com", "hotmail.com"},
		{"hotmaill.com", "hotmail.com"},
		{"hotmai.com", "hotmail.com"},
		{"hotmail.con", "hotmail.com"},

		// Yahoo typos
		{"yaho.com", "yahoo.com"},
		{"yahooo.com", "yahoo.com"},
		{"yhoo.com", "yahoo.com"},
		{"yahoo.con", "yahoo.com"},

		// iCloud & Proton typos
		{"iclud.com", "icloud.com"},
		{"protonmai.com", "protonmail.com"},
	}

	for _, tt := range tests {
		got := SuggestDomain(tt.input)
		if got != tt.expected {
			t.Errorf("SuggestDomain(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestSuggestEmail(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"bar.wepixel@gmai.com", "bar.wepixel@gmail.com"},
		{"barcohen@gmali.com", "barcohen@gmail.com"},
		{"barcohen@gmail.con", "barcohen@gmail.com"},
		{"user@hotmial.com", "user@hotmail.com"},
		{"user@gmail.com", ""},
		{"invalid-no-at-sign", ""},
	}

	for _, tt := range tests {
		got := SuggestEmail(tt.input)
		if got != tt.expected {
			t.Errorf("SuggestEmail(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}
