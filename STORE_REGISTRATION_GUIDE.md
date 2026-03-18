# Chrome Web Store Submission Guide (English)

Copy and paste the following English descriptions into the corresponding fields in the Chrome Web Store developer console.

---

## 1. Single Purpose (전용 목적)
**Field: [Single Purpose Description]**
> This extension is designed solely for displaying author information and cumulative post history for the MLBPark (donga.com) community. It functions as a research tool that retrieves public user metadata and article lists only from the specified host (mlbpark.donga.com) to provide users with organized context about article authors within a dedicated side panel. It does not engage in any automated posting, data scraping beyond what is necessary for profile display, or any other unrelated activities.

---

## 2. Permission Requests (권한 요청 이유)

### sidePanel
> Required to provide a dedicated and persistent interface that displays the author profile dashboard and post history list specifically tailored to the community article the user is currently reading. This ensures the information is accessible without obstructing the primary browsing experience or requiring navigation away from the active page.

### tabs
> Used to programmatically monitor tab activity to ensure the side panel content remains synchronized with the user's active browsing context. This is necessary for the core functionality of updating author information in real-time and restoring tab-specific UI states as the user switches between different community articles.

### storage
> Needed to securely save and retrieve user-specific preferences, such as the list of blocked authors, and to maintain the UI state (e.g., scroll position and filters) for each active tab. This ensures that the user's blocking settings and browsing context persist across browser sessions.

### contextMenus
> Used to provide a convenient entry point for the user to initiate a profile search for a specific author via a right-click action on their nickname. This streamlines the process of opening the side panel for targeted user analysis upon explicit user action.

### declarativeNetRequest / declarativeNetRequestWithHostAccess
> Used to systemically manage network request headers, such as the 'Referer' header, required by the host (mlbpark.donga.com) for authentication of public metadata requests. This is necessary to ensure the extension can reliably fetch and display post lists within the side panel environment while adhering to security policies.

### Host Permissions (`https://mlbpark.donga.com/*`)
> Access to https://mlbpark.donga.com/* is required to fetch the post lists and user metadata viewed by the user. This is the essential data source for the extension's primary function of displaying author history. The extension will only access this specific domain to retrieve the necessary community data for UI display.
