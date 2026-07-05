# LeetCode Sync Extension (`apps/extension`)

The Chrome Extension acts as the automatic bridge between competitive programming platforms (like LeetCode and Codeforces) and the Placement Prep dashboard.

## Why is it used?
When a student practices coding problems, they often lose track of their submissions, the exact code they wrote, and they lack immediate, deep AI feedback on their specific approach. This extension solves that by passively collecting data in the background and sending it to the platform.

## What is it used for?
- **Problem Extraction:** Automatically scraping the problem title, difficulty, topic tags, and HTML content from the webpage.
- **Code Extraction:** Reading the user's submitted code from the browser DOM.
- **Data Synchronization:** Securely posting this data to the Placement Prep API Gateway (`http://localhost:3000` / production URL).

## How is it used?

The extension is entirely passive. It uses Chrome's `content_scripts` to inject logic into matching URLs (`https://leetcode.com/*` and `https://codeforces.com/*`). When the user successfully submits a solution, the `content.js` script extracts the code and problem data, and sends a message to the `background.js` service worker, which then synchronizes the payload with the platform's API.

### Installation for Development

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Toggle **Developer mode** in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the `placement-prep/apps/extension` folder.

Whenever you make changes to `content.js` or `background.js`, click the "Reload" icon on the extension card in the `chrome://extensions/` page.

### Configuration
The extension communicates with the Web Dashboard and API. If you are developing locally, it is configured in `manifest.json` to allow connections to `http://localhost:3000/*`.
