# Frontend Architecture

## Overview
The frontend is built using **Next.js** (App Router) with **TypeScript**. It utilizes **Tailwind CSS** for styling and **NextAuth.js** (implied by `AuthSessionProvider`) for authentication session management.

## Key Technologies
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js / Custom Session Provider
- **Font**: Geist (via `next/font`)

## Project Structure
The project follows the standard Next.js App Router structure:

### `src/app`
Contains the application routes and layouts.
- `layout.tsx`: The root layout, including the `Header`, `Footer`, and `AuthSessionProvider`.
- `page.tsx`: The landing page.
- `globals.css`: Global styles and Tailwind directives.

### `src/components`
Reusable UI components.
- **Layout**: `Header.tsx`
- **Providers**: `AuthSessionProvider.tsx` (Wraps the app with authentication context)
- **Dashboard/Metrics**:
    - `RealTimeMetricsDashboard.tsx`
    - `MetricsComparisonDashboard.tsx`
    - `ThroughputGraph.tsx`, `LatencyHistogram.tsx`, etc.
- **UI Library**: `ui/` directory containing generic UI elements (buttons, inputs, etc.).

### `src/lib`
Utility functions and API clients.
- `api.ts`: Wrapper for making API requests to the backend.
- `utils.ts`: General utility functions.

## State Management
- **Server State**: Managed via Next.js Server Components and React Query (if applicable, or direct fetch).
- **Client State**: React `useState` and `useEffect` for local component state.
- **Auth State**: Managed via `AuthSessionProvider`.

## API Integration
API calls are handled in `src/lib/api.ts`. The frontend communicates with the backend via REST endpoints, typically proxied through Nginx or directly to the backend URL.
