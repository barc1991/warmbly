package emailverify

import (
	"strings"
)

// popularDomains lists the most common email service provider domains that
// users frequently mistype.
var popularDomains = []string{
	"gmail.com",
	"googlemail.com",
	"outlook.com",
	"hotmail.com",
	"live.com",
	"yahoo.com",
	"icloud.com",
	"aol.com",
	"proton.me",
	"protonmail.com",
	"walla.co.il",
}

var popularDomainSet = func() map[string]bool {
	m := make(map[string]bool, len(popularDomains))
	for _, d := range popularDomains {
		m[d] = true
	}
	return m
}()

// commonTldTypos maps mistyped TLD suffixes to .com.
var commonTldTypos = []string{
	".con",
	".cmo",
	".cpm",
	".comm",
	".ocm",
}

// SuggestDomain checks whether the given domain looks like a typo of a popular
// email provider domain. Returns the suggested domain name, or an empty string
// if no obvious typo is detected.
func SuggestDomain(domain string) string {
	d := strings.ToLower(strings.TrimSpace(domain))
	if d == "" || popularDomainSet[d] {
		return ""
	}

	// 1. Check for common TLD typos on known provider prefixes (e.g. gmail.con -> gmail.com).
	for _, tldTypo := range commonTldTypos {
		if strings.HasSuffix(d, tldTypo) {
			prefix := strings.TrimSuffix(d, tldTypo)
			target := prefix + ".com"
			if popularDomainSet[target] {
				return target
			}
		}
	}

	// 2. Special case: ".co" suffix without ccTLD (e.g. gmail.co -> gmail.com, walla.co -> walla.co.il).
	if strings.HasSuffix(d, ".co") && !strings.Contains(d, ".co.") {
		if popularDomainSet[d+".il"] {
			return d + ".il"
		}
		target := strings.TrimSuffix(d, ".co") + ".com"
		if popularDomainSet[target] {
			return target
		}
	}
	if d == "walla.com" {
		return "walla.co.il"
	}

	// 3. Edit distance check against each popular domain.
	// For short names (like gmail.com, yahoo.com), distance 1 or 2 catches
	// transpositions (gmali.com), deletions (gmai.com, gmil.com), and substitutions.
	for _, target := range popularDomains {
		dist := damerauLevenshtein(d, target)
		if dist == 1 {
			return target
		}
		// Allow distance 2 for longer domain names (>= 9 characters, e.g. googlemail.com, protonmail.com)
		// or when length is identical (2 transpositions/substitutions).
		if len(target) >= 9 && dist <= 2 {
			return target
		}
	}

	return ""
}

// SuggestEmail returns the full email with the domain corrected if an obvious
// typo was found in the domain part. Returns an empty string if no suggestion.
func SuggestEmail(email string) string {
	email = strings.TrimSpace(email)
	at := strings.LastIndex(email, "@")
	if at <= 0 || at == len(email)-1 {
		return ""
	}
	localpart := email[:at]
	domain := email[at+1:]

	if suggestedDomain := SuggestDomain(domain); suggestedDomain != "" {
		return localpart + "@" + suggestedDomain
	}
	return ""
}

// damerauLevenshtein computes the edit distance between two strings including
// insertions, deletions, substitutions, and adjacent character transpositions.
func damerauLevenshtein(a, b string) int {
	la, lb := len(a), len(b)
	if la == 0 {
		return lb
	}
	if lb == 0 {
		return la
	}

	// Allocate DP matrix: (la+1) x (lb+1)
	dp := make([][]int, la+1)
	for i := range dp {
		dp[i] = make([]int, lb+1)
	}

	for i := 0; i <= la; i++ {
		dp[i][0] = i
	}
	for j := 0; j <= lb; j++ {
		dp[0][j] = j
	}

	for i := 1; i <= la; i++ {
		for j := 1; j <= lb; j++ {
			cost := 0
			if a[i-1] != b[j-1] {
				cost = 1
			}

			del := dp[i-1][j] + 1
			ins := dp[i][j-1] + 1
			sub := dp[i-1][j-1] + cost

			min := del
			if ins < min {
				min = ins
			}
			if sub < min {
				min = sub
			}
			dp[i][j] = min

			// Transposition of adjacent characters
			if i > 1 && j > 1 && a[i-1] == b[j-2] && a[i-2] == b[j-1] {
				trans := dp[i-2][j-2] + 1
				if trans < dp[i][j] {
					dp[i][j] = trans
				}
			}
		}
	}

	return dp[la][lb]
}
