package mailhtml

import "testing"

// The inliner and the text renderer run on every send that carries a
// stylesheet, on markup the sender pasted from somewhere else. A panic here
// would take down a worker mid-send, so neither may ever do worse than return
// the body it was given.
func FuzzInlineCSS(f *testing.F) {
	f.Add(`<style>.a{color:red}</style><p class="a">hi</p>`)
	f.Add(`<style>@media(){`)
	f.Add(`<style>a{background:url(data:image/png;base64,AA{B;C)}</style><a>x</a>`)
	f.Add(`<style>*{}</style>`)
	f.Add(`<html><head><style>body{margin:0}</style></head><body><p>x</p></body></html>`)
	f.Add(`<style>.a{content:"}"}</style><p class="a">x</p>`)
	f.Add(`<style>@media screen{.a{color:red}}</style>`)
	f.Add("<style>" + `\` + "</style>")

	f.Fuzz(func(t *testing.T, body string) {
		out := InlineCSS(body)
		if body != "" && out == "" && HasStyleBlock(body) {
			// An empty result is only legitimate when the input was empty.
			t.Errorf("InlineCSS emptied a non-empty body: %q", body)
		}
		_ = ToPlainText(body)
		_ = Lint(body, len(body))
		_ = InsertBeforeBodyEnd(body, "[F]")
	})
}
