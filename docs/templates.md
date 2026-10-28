# Templates and settings files

## Customizable templates

Click the Hyperfriend icon in the browser toolbar to open the settings popup. Its **Templates** tab has a switch (**PR**, **Issue**, **Discussion**, **Run**) and the template of the selected link type. Defaults:

- Pull Request: `[PR {{pr_number}}]: {{pr_name}}`
- Issue: `[Issue {{issue_number}}]: {{issue_name}}`
- Discussion: `[Discussion {{discussion_number}}]: {{discussion_name}}`
- Workflow run: `[{{workflow}} #{{run_number}}]: {{run_name}}`

**Square brackets mark the link.** Only the text inside `[` and `]` becomes the hyperlink; the rest is plain text. With the defaults a Pull Request pastes as the link "PR 12" followed by the plain text ": Add copy button to PR list". This keeps the link short: Microsoft Teams makes the whole pasted text one blue link and shortens long link text, so a short link such as "PR 12" stays readable.

| Placeholder             | Available in  | Replaced with                                                     | Example                      |
| ----------------------- | ------------- | ----------------------------------------------------------------- | ---------------------------- |
| `{{pr_number}}`         | Pull Requests | Pull Request number                                               | `12`                         |
| `{{pr_name}}`           | Pull Requests | Pull Request title                                                | `Add copy button to PR list` |
| `{{issue_number}}`      | Issues        | Issue number                                                      | `34`                         |
| `{{issue_name}}`        | Issues        | Issue title                                                       | `Button is not shown`        |
| `{{owner}}`             | Both          | Repository owner                                                  | `borbiuk`                    |
| `{{repo}}`              | Both          | Repository name                                                   | `hyperfriend`                |
| `{{url}}`               | Both          | Canonical Pull Request / Issue                                    | `https://github.com/…`       |
| `{{ref}}`               | Both          | Short reference `owner/repo#number`                               | `borbiuk/hyperfriend#12`     |
| `{{author}}`            | Both          | Login of the author                                               | `borbiuk`                    |
| `{{state}}`             | Both          | `open`, `closed`, `merged` or `draft`                             | `merged`                     |
| `{{labels}}`            | Both          | Label names, separated by a comma and a space                     | `bug, ui`                    |
| `{{assignees}}`         | Both          | Assignee logins, separated by a comma and a space                 | `borbiuk, octocat`           |
| `{{milestone}}`         | Both          | Milestone title                                                   | `v2 release`                 |
| `{{base_branch}}`       | Pull Requests | Target branch, as the page shows it                               | `master`                     |
| `{{head_branch}}`       | Pull Requests | Source branch, as the page shows it (`owner:branch` in forks)     | `copy-button`                |
| `{{discussion_number}}` | Discussions   | Discussion number                                                 | `5`                          |
| `{{discussion_name}}`   | Discussions   | Discussion title                                                  | `Ideas for new placeholders` |
| `{{category}}`          | Discussions   | Discussion category                                               | `Ideas`                      |
| `{{run_number}}`        | Workflow runs | Run number shown as `#20481` (not the run id of the URL)          | `42`                         |
| `{{run_name}}`          | Workflow runs | Name of the run (commit message, pull request title, ...)         | `Add copy button to PR list` |
| `{{workflow}}`          | Workflow runs | Workflow name                                                     | `CI`                         |
| `{{branch}}`            | Workflow runs | Branch of the run, as the page shows it (`owner:branch` in forks) | `main`                       |
| `{{status}}`            | Workflow runs | Status in the words of the page                                   | `completed successfully`     |

Where the data comes from: the number, title, owner, repo, `{{url}}` and, for Pull Requests, Issues and Discussions, `{{ref}}` are always known. For a Discussion `{{ref}}` and `{{author}}` are available as for the others; `{{labels}}`, `{{state}}` and the other Pull Request and Issue details are not (they stay as typed). A workflow run has no `{{ref}}`, because a run is not a numbered item of the repository. The other placeholders are read from the page you copy on. A **list row** shows the author, the state and the labels of a Pull Request or Issue, the author and the category of a Discussion, and the workflow, the status and the branch of a workflow run (search results show none of them); a **Pull Request or Issue page** shows all of them (the branches on Pull Requests only). A placeholder whose data the page does not show is replaced with nothing, so `{{labels}}` is empty when the item has no labels or the row shows none.

Notes:

- Brackets are read in the template only, before the placeholders are filled, so brackets in a title (for example `[WIP] Fix`) never matter.
- The first `[`…`]` pair is the link; later brackets are plain text. A `[` without a closing `]` is plain text too. Write `\[` or `\]` for a literal bracket.
- Without brackets, or with an empty `[]`, the whole text is the link, exactly as in 2.0.0 and earlier: `PR {{pr_number}}: {{pr_name}}` pastes as one link "PR 12: Add copy button to PR list".
- Spaces at the edges of the bracketed part stay outside the link: `[ PR {{pr_number}} ]: …` links only "PR 12".
- A bracket can't cut through a placeholder: `{{pr_[number]}}` is not a placeholder.
- `text/plain` never contains the brackets: `PR 12: Add copy button to PR list — https://github.com/…`.
- The live preview in the popup underlines the part that will be the link, and a hint above the fields reminds you of the square brackets and that details such as labels, assignees and branches are filled only where the page shows them.
- Spaces inside the braces are allowed: `{{ pr_number }}`.
- Unknown placeholders (including the ones of the other link type, such as `{{head_branch}}` in an Issue template) are left as they are. A known placeholder without data is replaced with an empty text, and the spaces around it stay, so `{{state}} {{labels}}` can leave a double space.
- An empty template, or one that renders to empty text (for example `[]`), falls back to the default one.
- Settings are saved in the browser sync storage, so they follow you across devices signed in to the same browser account. When you update from 1.x or 2.0.0, your saved templates are converted once: a template that is exactly the old default (`PR {{pr_number}}: {{pr_name}}` / `Issue {{issue_number}}: {{issue_name}}`) becomes the new bracketed default, and any other template keeps its text as it was, with its `[` and `]` escaped (`\[` and `\]`), so it copies exactly as before (the whole text is the link). Add square brackets to it yourself to mark a shorter link.

## Sharing settings with your team

Export your settings to a file and let teammates import it, so everybody pastes links in the same format. The file holds the templates, the copy format, the shortcuts and the display settings.

1. Open the Hyperfriend popup, go to the **General** tab and click **Export**. The browser downloads `hyperfriend-settings.json`.
2. Share the file (chat, repository, wiki).
3. A teammate opens the **General** tab, clicks **Import** and picks the file. The settings update and "Settings imported." is shown.

In Chrome, Export and Import work right in the popup. In **Firefox** the popup closes when the download panel or the file picker opens, so **both Export and Import** open the settings page in a browser tab (`options_ui` with `open_in_tab`, on the General tab), where they work the same way. The settings page is also available from the extension's options in the browser's extensions manager.

File format (schema version 5):

```json
{
	"app": "hyperfriend",
	"schemaVersion": 5,
	"exportedAt": "2026-10-20T18:00:00.000Z",
	"templates": {
		"pull-request": "[PR {{pr_number}}]: {{pr_name}}",
		"issue": "[Issue {{issue_number}}]: {{issue_name}}",
		"discussion": "[Discussion {{discussion_number}}]: {{discussion_name}}",
		"workflow-run": "[{{workflow}} #{{run_number}}]: {{run_name}}"
	},
	"format": "rich",
	"shortcuts": {
		"copy-link": {
			"keys": ["Shift", "KeyC"],
			"enabled": true
		}
	},
	"display": {
		"authorAvatars": true
	},
	"filters": {
		"chips": [
			"needs-your-review",
			"needs-team-review",
			"created-by-you",
			"ready-to-merge",
			"drafts",
			"ci-passing",
			"ci-failing",
			"ci-running",
			"my-waiting",
			"my-changes"
		],
		"sticky": { "drafts": false },
		"custom": [
			{
				"id": "custom-abcd1234",
				"label": "Bugs",
				"icon": "bug",
				"colour": "red",
				"query": "label:bug -label:wip"
			}
		]
	}
}
```

`keys` lists the modifiers in the order `Control`, `Alt`, `Shift`, `Meta`, followed by one [`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) value of the main key (`KeyC`, `Digit1`, `F5`, `ArrowUp`, ...). A disabled shortcut keeps its `keys`.

Schema version 5 is the first one with the quick `filters`. Schema version 4 (Hyperfriend 2.3.0 to 2.9.x) has the same layout without `filters`, and is the first one with the copy `format` (`rich` or `markdown`). Schema version 3 (Hyperfriend 2.1.0 to 2.2.1) has the same layout without `format`, and is the first one with the square bracket syntax in templates. Files exported by Hyperfriend 2.0.0 use schema version 2 (the same layout, templates without brackets). Files exported by Hyperfriend 1.0.0 use schema version 1 and contain `templates` only:

```json
{
	"app": "hyperfriend",
	"schemaVersion": 1,
	"exportedAt": "2026-10-19T18:00:00.000Z",
	"templates": {
		"pull-request": "PR {{pr_number}}: {{pr_name}}",
		"issue": "Issue {{issue_number}}: {{issue_name}}"
	}
}
```

Version 1 to 4 files still import. The templates of version 1 and 2 files are converted the same way as saved templates (the old default becomes the new default, other templates get their brackets escaped). A version 1 file applies the templates only; the shortcuts and display settings keep their current values. A version 3 file has no format, so the current copy format stays (a `format` field in it is not read). A version 4 file has no filters, so the current filters stay (a `filters` field in it is not read). Hyperfriend 2.2.1 and older do not read version 4 files, and 2.9.x and older do not read version 5 files ("created by a newer version of Hyperfriend").

Import rules:

- The file must be up to 64 KB (larger files are rejected before they are read) and valid JSON, with `"app": "hyperfriend"` and `"schemaVersion"` 1, 2, 3, 4 or 5. A higher version is rejected as "created by a newer version of Hyperfriend".
- `templates` must be an object. Only the keys `pull-request`, `issue`, `discussion` and `workflow-run` are read; other keys are ignored, and a template missing from the file keeps its current value (files exported by 2.3.0 and older have no `discussion` and `workflow-run`; 2.3.0 and older ignore them in newer files). Values are trimmed, and each must be a single line of text (no line breaks or control characters) of at most 500 characters; otherwise the error reads `Template "<key>" must be a single line of text up to 500 characters.` (In a version 1 file at least one known template must be present.)
- `format` (version 4 only) must be `"rich"` or `"markdown"`; otherwise the error reads `Format must be "rich" or "markdown".`
- `shortcuts` must be an object. Only the key `copy-link` is read. Its value needs `keys` that form a valid combination (at least one modifier, exactly one main key; a valid combination in another order is accepted and normalized) and a boolean `enabled`; otherwise the error reads `Shortcut "copy-link" is not valid.` A combination the browser uses is skipped: the shortcut keeps its current keys and the rest of the file is imported (newer versions reserve more combinations, so an older file can contain one).
- `display` must be an object. Only `authorAvatars` is read, and it must be `true` or `false`; otherwise the error reads `Display setting "authorAvatars" must be true or false.`
- `filters` (version 5 only) must be an object; every part is optional and other keys are ignored. `chips` is the list of the chips shown in the bar, **in the order of the bar**: known chip names without repeats (`needs-your-review`, `needs-team-review`, `created-by-you`, `ready-to-merge`, `drafts`, `approved`, `ci-passing`, `ci-failing`, `ci-running`, `my-waiting`, `my-changes`, `no-reviewer`, `involves`, `mentions`, `reviewed-by-me`, `not-reviewed-by-me`) and the ids of custom chips (`custom-` and 8 lower case letters or digits); an id of a custom chip that does not exist is dropped when the settings are applied, and an empty list shows no chips. `sticky` is an object with the boolean `drafts`. `custom` is a list of up to 10 chips of your own, each with a unique `id`, a `label` (one line, up to 30 characters and 48 bytes), an `icon` (one of the 36 icon names of the popup; a chip already stored with an icon or colour this version does not know is kept), a `colour` (`default`, `green`, `red`, `yellow`, `blue`, `purple`, `orange` or `gray`) and a `query` (the filter: up to 10 different words without groups (`OR`, parentheses) or `is:pr`, 200 characters and 200 bytes where a quotation mark or backslash counts twice, closed quotation marks, one line); the file's list replaces the stored one. Errors read `Filter setting "chips" must be a list of known filter names.`, `Filter setting "sticky" must hold true or false values.`, `Filter setting "custom" must be a list of chips.`, `Filter setting "custom" must hold up to 10 chips.`, `Custom chip id "ID" is used twice.` and a message that names the chip for a bad id, name, icon, colour or filter (for example `Custom chip "Bugs" has an unknown icon.`).
- In a version 2, 3, 4 or 5 file every section is optional, but at least one setting must be present ("The file does not contain any settings.").
- A setting missing from the file keeps its current value. Everything is applied with one write to the sync storage.
- Problems are shown as a short message under the buttons, and nothing is changed.
- `exportedAt` is informational only.
