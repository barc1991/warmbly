package leadnormalize

import (
	"regexp"
	"strings"
)

var (
	// Corporate suffix patterns (Hebrew & English)
	corpSuffixes = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\s*(?:[\(\[](?:ישראל|החזקות|[0-9]{4})[\)\]])?\s*(?:בע["״'׳]?מ|ע["״'׳]?מ|בעמ)\.?\s*$`),
		regexp.MustCompile(`(?i)\s*(?:[\(\[](?:israel|holdings|group)[\)\]])?\s*(?:ltd|llc|inc|corp|corporation|gmbh|co|s\.a\.|limited)\.?\s*$`),
	}

	// Corporate prefix patterns (Hebrew)
	corpPrefixes = []*regexp.Regexp{
		regexp.MustCompile(`^(?:חברת|חב['׳]|קבוצת|סוכנות|משרד|רשת)\s+`),
	}

	// Common job title suffixes mistakenly placed in name
	titleSuffixes = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\s*[-–—|]\s*(?:ceo|cto|cmo|coo|founder|owner|partner|director|vp|manager|מנכ["״'׳]?ל|סמנכ["״'׳]?ל|בעלים|מייסד|מנהל|שותף).*$`),
	}

	wsCleanup = regexp.MustCompile(`\s+`)
)

// NormalizedLead holds cleaned name and company values.
type NormalizedLead struct {
	FirstName string
	LastName  string
	Company   string
	JobTitle  string
	IsCompany bool
}

// CleanCorporateName strips legal entity designations from a company name.
func CleanCorporateName(raw string) string {
	s := strings.TrimSpace(raw)
	for _, re := range corpSuffixes {
		s = re.ReplaceAllString(s, "")
	}
	for _, re := range corpPrefixes {
		s = re.ReplaceAllString(s, "")
	}
	s = wsCleanup.ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

// NormalizeContactName takes first, last, and company names and resolves them cleanly.
func NormalizeContactName(rawFirst, rawLast, rawCompany, rawTitle string) NormalizedLead {
	first := strings.TrimSpace(rawFirst)
	last := strings.TrimSpace(rawLast)
	company := strings.TrimSpace(rawCompany)
	title := strings.TrimSpace(rawTitle)

	// 1. Check if first or last contains title suffix
	for _, re := range titleSuffixes {
		if loc := re.FindStringIndex(first); loc != nil {
			if title == "" {
				title = strings.TrimSpace(strings.Trim(first[loc[0]:], "-–—| "))
			}
			first = strings.TrimSpace(first[:loc[0]])
		}
		if loc := re.FindStringIndex(last); loc != nil {
			if title == "" {
				title = strings.TrimSpace(strings.Trim(last[loc[0]:], "-–—| "))
			}
			last = strings.TrimSpace(last[:loc[0]])
		}
	}

	// 2. Check if first name is actually a company (e.g. "חברת אלפא בע\"מ")
	isFirstCompany := isCorporateEntity(first)
	if isFirstCompany {
		if company == "" {
			company = CleanCorporateName(first)
		}
		first = ""
	}

	// 3. Check if combined name has corporate suffix
	for _, re := range corpSuffixes {
		first = re.ReplaceAllString(first, "")
		last = re.ReplaceAllString(last, "")
	}

	// 4. If first has both names (e.g. "יוסי כהן") and last is empty
	if first != "" && last == "" {
		parts := strings.SplitN(first, " ", 2)
		first = parts[0]
		if len(parts) > 1 {
			last = parts[1]
		}
	}

	// Clean corporate name
	if company != "" {
		company = CleanCorporateName(company)
	}

	return NormalizedLead{
		FirstName: strings.TrimSpace(first),
		LastName:  strings.TrimSpace(last),
		Company:   strings.TrimSpace(company),
		JobTitle:  strings.TrimSpace(title),
		IsCompany: isFirstCompany,
	}
}

func isCorporateEntity(s string) bool {
	norm := strings.ToLower(strings.TrimSpace(s))
	for _, re := range corpPrefixes {
		if re.MatchString(norm) {
			return true
		}
	}
	for _, re := range corpSuffixes {
		if re.MatchString(norm) {
			return true
		}
	}
	return false
}
