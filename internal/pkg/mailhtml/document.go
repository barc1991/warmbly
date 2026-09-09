package mailhtml

import (
	"regexp"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

var (
	styleOpen  = regexp.MustCompile(`(?i)<style[\s>]`)
	docMarkers = regexp.MustCompile(`(?i)<(!doctype\s|html[\s>]|body[\s>]|head[\s>])`)
)

// isFullDocument reports whether a body is a whole HTML document rather than
// the fragment our own editor emits. The two are rendered back differently:
// a fragment must not gain an <html> wrapper it never had.
func isFullDocument(body string) bool {
	return docMarkers.MatchString(body)
}

// IsFullDocument reports whether a body was authored as a complete HTML
// document. Callers that wrap a body in their own shell (a preview frame) need
// to know not to nest one document inside another.
func IsFullDocument(body string) bool { return isFullDocument(body) }

// InsertBeforeBodyEnd places a fragment at the end of the message body: just
// inside </body> for a full document, at the end otherwise.
//
// The closing tag is found by scanning rather than by searching for the
// literal string, because HTML mail is full of Outlook conditional comments
// (<!--[if mso]> … <![endif]-->) and a </body> written inside one is not the
// document's. Inserting there put the signature and the opt-out footer inside
// a comment, where Outlook showed them and every other client did not.
func InsertBeforeBodyEnd(body, fragment string) string {
	if fragment == "" {
		return body
	}
	if at := lastRealTag(body, "body"); at >= 0 {
		return body[:at] + fragment + body[at:]
	}
	if at := lastRealTag(body, "html"); at >= 0 {
		return body[:at] + fragment + body[at:]
	}
	return body + fragment
}

// lastRealTag returns the offset of the last closing tag with the given name
// that is genuine markup, skipping any inside a comment, <script> or <style>.
// -1 when there is none.
func lastRealTag(body, name string) int {
	found := -1
	lower := strings.ToLower(body)
	for i := 0; i < len(lower); {
		switch {
		case strings.HasPrefix(lower[i:], "<!--"):
			end := strings.Index(lower[i+4:], "-->")
			if end < 0 {
				return found
			}
			i += 4 + end + 3
		case strings.HasPrefix(lower[i:], "<script"):
			i = skipRawText(lower, i, "</script")
		case strings.HasPrefix(lower[i:], "<style"):
			i = skipRawText(lower, i, "</style")
		case strings.HasPrefix(lower[i:], "</"+name):
			rest := lower[i+2+len(name):]
			trimmed := strings.TrimLeft(rest, " \t\r\n\f")
			if strings.HasPrefix(trimmed, ">") {
				found = i
			}
			i += 2 + len(name)
		default:
			i++
		}
	}
	return found
}

func skipRawText(lower string, i int, closer string) int {
	end := strings.Index(lower[i:], closer)
	if end < 0 {
		return len(lower)
	}
	return i + end + len(closer)
}

func attrOf(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

func setAttr(n *html.Node, key, val string) {
	for i := range n.Attr {
		if n.Attr[i].Key == key {
			if val == "" {
				n.Attr = append(n.Attr[:i], n.Attr[i+1:]...)
				return
			}
			n.Attr[i].Val = val
			return
		}
	}
	if val != "" {
		n.Attr = append(n.Attr, html.Attribute{Key: key, Val: val})
	}
}

// mediaAttr reports a <style media="…"> narrower than what the reader sees.
// "all" and "screen" are the reader; print and device queries are not.
func mediaAttr(n *html.Node) string {
	m := strings.TrimSpace(strings.ToLower(attrOf(n, "media")))
	if m == "" || m == "all" || m == "screen" {
		return ""
	}
	return m
}

func textOf(n *html.Node) string {
	var b strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.TextNode {
			b.WriteString(c.Data)
		}
	}
	return b.String()
}

func setText(n *html.Node, text string) {
	for c := n.FirstChild; c != nil; {
		next := c.NextSibling
		n.RemoveChild(c)
		c = next
	}
	if text != "" {
		n.AppendChild(&html.Node{Type: html.TextNode, Data: text})
	}
}

// renderTo serializes the parsed tree back. A body that arrived as a fragment
// leaves as one: html.Parse always builds html/head/body around it, and
// emitting that wrapper would turn every ordinary campaign body into a
// document. Any stylesheet the parser hoisted into the head comes back with
// the fragment, or the rules that could not be inlined would be lost.
func renderTo(doc *html.Node, fragment bool) (string, error) {
	if !fragment {
		var b strings.Builder
		if err := html.Render(&b, doc); err != nil {
			return "", err
		}
		return b.String(), nil
	}

	var b strings.Builder
	render := func(n *html.Node) error { return html.Render(&b, n) }

	if head := findElement(doc, atom.Head); head != nil {
		for c := head.FirstChild; c != nil; c = c.NextSibling {
			if c.Type == html.ElementNode && c.DataAtom == atom.Style {
				if err := render(c); err != nil {
					return "", err
				}
			}
		}
	}
	body := findElement(doc, atom.Body)
	if body == nil {
		return "", errNoBody
	}
	for c := body.FirstChild; c != nil; c = c.NextSibling {
		if err := render(c); err != nil {
			return "", err
		}
	}
	return b.String(), nil
}

func findElement(root *html.Node, a atom.Atom) *html.Node {
	if root.Type == html.ElementNode && root.DataAtom == a {
		return root
	}
	for c := root.FirstChild; c != nil; c = c.NextSibling {
		if n := findElement(c, a); n != nil {
			return n
		}
	}
	return nil
}
