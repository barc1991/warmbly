package leadnormalize

import (
	"testing"
)

func TestCleanCorporateName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"אקמי פתרונות בע\"מ", "אקמי פתרונות"},
		{"חברת מגה סוכנויות בעמ", "מגה סוכנויות"},
		{"Acme Global Tech LTD.", "Acme Global Tech"},
		{"StartApp LLC", "StartApp"},
		{"קבוצת ברק פרסום", "ברק פרסום"},
	}

	for _, tt := range tests {
		got := CleanCorporateName(tt.input)
		if got != tt.expected {
			t.Errorf("CleanCorporateName(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

func TestNormalizeContactName(t *testing.T) {
	tests := []struct {
		first, last, company, title              string
		wantFirst, wantLast, wantComp, wantTitle string
	}{
		{
			first: "יוסי כהן", last: "", company: "אלפא סחר בע\"מ", title: "",
			wantFirst: "יוסי", wantLast: "כהן", wantComp: "אלפא סחר", wantTitle: "",
		},
		{
			first: "דן לוי - מנכ\"ל", last: "", company: "בטא טק LTD", title: "",
			wantFirst: "דן", wantLast: "לוי", wantComp: "בטא טק", wantTitle: "מנכ\"ל",
		},
		{
			first: "חברת גמא בע\"מ", last: "", company: "", title: "",
			wantFirst: "", wantLast: "", wantComp: "גמא", wantTitle: "",
		},
	}

	for _, tt := range tests {
		res := NormalizeContactName(tt.first, tt.last, tt.company, tt.title)
		if res.FirstName != tt.wantFirst || res.LastName != tt.wantLast || res.Company != tt.wantComp || res.JobTitle != tt.wantTitle {
			t.Errorf("NormalizeContactName(%q, %q, %q, %q) = %+v; want First:%q Last:%q Comp:%q Title:%q",
				tt.first, tt.last, tt.company, tt.title, res, tt.wantFirst, tt.wantLast, tt.wantComp, tt.wantTitle)
		}
	}
}
