# Memory and Encoding Strategies Experiment

A static browser-based experiment built with plain HTML, CSS, and JavaScript.

## Run locally
1. Keep `index.html`, `styles.css`, and `script.js` in the same folder.
2. Open `index.html` in a modern browser.
3. Select **Begin experiment** and complete the blocks, counting task, and recall.

No server, framework, package installation, or build step is required.

## Publish with GitHub Pages
1. Create a new GitHub repository.
2. Upload the three files (and optionally this README) to the repository root.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then save.
6. Wait for GitHub Pages to publish and open the public URL shown in Settings → Pages.

## Data
At the end of a completed session, download:
- A summary CSV with one row per session.
- A trial-level CSV with 18 rows per session, one for each studied word.

Data are generated and downloaded in the browser. This version does not transmit or store participant data on a server. The participant code is optional. Avoid collecting names or other identifying information unless your course/instructor has approved that procedure.

## Design notes
- Strategy order and list-to-strategy assignment are independently randomized each session.
- Each word is shown for 3 seconds.
- The distractor is timed for 30 seconds and asks participants to enter successive subtractions by 3.
- Recall matching is case-insensitive and allows a one-character typo for words of at least five letters, plus a small set of common equivalents (e.g., bunny for rabbit).
- The word lists are fixed across sessions; only their assignment to strategies is randomized.
