# React + TypeScript + Vite

## Entity Filters

The Entities page provides scopes for all entities, owned portfolio holdings,
owned watchlist entries and entities with active screener signals. Scope and
text search are applied server-side before the 500-row limit. Row indicators
show portfolio/watchlist membership and active signals. Active signals are not
labelled as top movers: no price-change threshold is inferred.

The backend requires manual installation of
`oneshot/install_entity_list_filters.sql` before serving the updated entity list.

## Screener CSV Export

The Screener grid provides CSV export through the native MUI DataGrid toolbar.
It exports the loaded, filtered and sorted results across grid pages, using the
visible columns. API filters currently load at most 500 opportunities; this is
not a full-database export. No additional endpoint or database routine is used.
CSV files use UTF-8 with BOM and formula escaping for spreadsheet safety.

## Contextual Screener

The Screener context selector lists owned watchlists and portfolios plus active
universes, with instrument counts. Context selection filters existing results;
the separate analysis action runs the shared backend scan and refreshes results,
variations and history. Empty contexts and contexts exceeding 1000 instruments
cannot be analyzed. Backend errors distinguish missing contexts, busy analyses
and failed requests. Analysis updates the global ranking and creates a history
snapshot; partial runs are not used for complete comparisons.

Strategy and consensus filters are delegated to SQL. Advanced filters are
collapsed initially. Optional 60-second data refresh is disabled by default and
paused during manual analysis; it does not launch analyses. The backend requires
manual installation of `oneshot/install_screener_contexts.sql`.

## AI Results

Portfolio and watchlist details link directly to Screener with their context
selected in the URL. The signals table shows the AI verdict, score and summary;
opening a signal starts on its AI analysis. Technical data and history/positions
remain available in separate detail tabs. Less-used table columns are initially
hidden but can be restored through the grid toolbar.

The AI results tab includes persisted signals with an AI score within the current
filters, not only signals updated by the latest run. The analysis confirmation
reports updated, selected and failed signals; a run may select no new candidates.
AI remains optional and disabled by default. Snapshot comparisons, CSV export,
performance and run history remain available.

## Contextual Monitoring

Watchlist and portfolio detail pages reuse the account alert rule component for
rules dedicated to the current collection. New rules default to that collection;
scope and collection cannot be changed from the contextual editor. Screener's
separate monitoring tab shows the selected portfolio/watchlist rules, or Screener
rules for the global and universe views, including older rules with no explicit scope. Account
settings remain the complete view for global rules and rules across collections.
Contextual views share the user-scoped React Query cache, saving API and event
history with account settings. Navigating between collections resets editor and
history state. No additional API or database installation is required beyond the
existing monitoring installers.

## Alert Event History

Account alert rules include a history action with 25 events per page, refresh,
loading, empty and retry states. The shared alert service calls the authenticated
`/alerts/{rule_id}/events` endpoint; React Query caches by user, rule and offset.
History displays saved signal or price context and current notification status.
Events without a notification are shown as not queued, with the saved skip reason
when available. Older events retain an unknown reason.
Cooldown and duplicate matches do not create history entries. Refresh returns
to the latest page; new events can shift offset-based pages.

The backend requires manual installation of
`oneshot/install_alert_event_history.sql`, after the alert management and
collection monitoring installers. No automatic migration is run.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
