# PixelPlace

## Overview

PixelPlace is a collaborative pixel art canvas application where users can place colored pixels on a shared 512x512 grid. The application features real-time collaboration, user authentication, a token-based placement system to prevent spam, and a glassmorphism-inspired UI design. Users can select colors from a predefined palette or use a custom color picker, save frequently used colors, and interact with the canvas through intuitive zoom and pan controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Pure JavaScript ES6 Modules**: No framework dependencies, using native ES6 modules for clean code organization
- **Canvas-based Rendering**: HTML5 Canvas with optimized viewport culling for smooth performance on large grids
- **Modular Design**: Separated concerns with dedicated modules for canvas operations, Supabase integration, and main application logic
- **Responsive Layout**: CSS Grid-based responsive design that adapts to mobile and desktop screens
- **Glassmorphism UI**: Modern glass-effect styling with backdrop filters and subtle transparency effects

### State Management
- **Client-side State**: Local state management for user data, canvas viewport, color selections, and token counts
- **Real-time Synchronization**: Supabase real-time subscriptions for live pixel updates across all connected users
- **Optimistic Updates**: Immediate local canvas updates with server synchronization for smooth user experience

### Canvas System
- **Efficient Rendering**: Viewport-based culling system that only renders visible pixels for performance optimization
- **Pixel Storage**: Map-based pixel storage using coordinate strings as keys for O(1) lookup performance
- **Interactive Controls**: Mouse and touch event handling for pixel placement, panning, and zooming with device pixel ratio support

### Authentication & Rate Limiting
- **Token-based Placement**: 100-token system with automatic 10-second refill intervals to prevent canvas spam
- **User Authentication**: Supabase Auth integration for user management and ownership tracking
- **Placement Restrictions**: Authenticated users only can place pixels, with visual feedback for placement attempts

## External Dependencies

### Database & Backend Services
- **Supabase**: Primary backend-as-a-service provider handling authentication, real-time database, and API endpoints
  - PostgreSQL database for pixel storage with x/y coordinates, color values, timestamps, and owner tracking
  - Real-time subscriptions for live collaborative updates
  - Row Level Security (RLS) policies for data access control

### Third-party Libraries
- **Supabase JavaScript Client**: CDN-delivered ES module for database operations and real-time functionality
- **Browser APIs**: Native HTML5 Canvas API, Web Storage API, and device pixel ratio detection for high-DPI displays

### Configuration Requirements
- Supabase project URL and anonymous API key must be configured in `src/main.js`
- Database schema expects a `pixels` table with columns: `x`, `y`, `color`, `updated_at`, `owner_id`
- Real-time functionality requires Supabase real-time API enabled for the pixels table