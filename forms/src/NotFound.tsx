// Terminal states, word-for-word with the static pages the Go service serves
// for the same conditions at the shell level.

export function NotFound() {
    return (
        <div className="plain">
            <h1>טופס זה אינו זמין עוד</h1>
            <p>ייתכן שהטופס הוסר או שבוטל פרסומו.</p>
        </div>
    );
}

export function Unavailable() {
    return (
        <div className="plain">
            <h1>הטופס אינו זמין כעת</h1>
            <p>אנא נסה שוב בעוד מספר רגעים.</p>
        </div>
    );
}

// StalePage: the tab outlived its render token (12h); only a reload mints a
// new one.
export function StalePage() {
    return (
        <div className="plain">
            <h1>תוקף העמוד פג</h1>
            <p>העמוד היה פתוח זמן ממושך. רענן את העמוד כדי להמשיך.</p>
            <button type="button" onClick={() => window.location.reload()}>
                רענן
            </button>
        </div>
    );
}
