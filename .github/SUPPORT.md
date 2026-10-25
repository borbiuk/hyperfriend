# Support

## Questions and problems

- **Something does not work, or a button is missing**: open a [bug report](https://github.com/borbiuk/hyperfriend/issues/new?template=bug_report.md). If the buttons disappeared after a change on GitHub, first look at the open issue labelled `markup-drift`: the daily check opens it when the tests fail on GitHub's current markup, so the cause may be known already.
- **An idea**: open a [feature request](https://github.com/borbiuk/hyperfriend/issues/new?template=feature_request.md).
- **A security problem**: do not open an issue. Follow [SECURITY.md](../SECURITY.md).

## What is supported

- **Chrome** (current stable) and **Firefox** (desktop 140 and newer, Firefox for Android 142 and newer, as declared in the manifest). The automated tests cover Chromium only, so a Firefox problem may need a manual check.
- **github.com**, **GitHub Enterprise Cloud** (`*.ghe.com`) and **GitHub Enterprise Server** on the domains you add in the settings. See the [README](../README.md).
- Only the latest released version gets fixes ([SECURITY.md](../SECURITY.md)).

## When GitHub changes its pages

The extension reads GitHub's page markup, so a redesign on GitHub can break a button or a placeholder. A daily check tests the extension against GitHub's current pages. A fix is released as a normal update; there is no promised response time.
