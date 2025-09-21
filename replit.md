# Sprinkler Control System

## Overview

A modern web-based sprinkler control system built with React, Express, and PostgreSQL. The application provides a comprehensive dashboard for managing irrigation zones, schedules, and system status through an intuitive interface designed for mobile and desktop use.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state and caching
- **Build Tool**: Vite with hot module replacement for development

The frontend follows a modern component-based architecture with:
- Page-level components for main routes (Dashboard, Schedules, Settings)
- Reusable UI components from shadcn/ui
- Custom hooks for device detection and toast notifications
- Mobile-first responsive design with bottom navigation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Session Management**: Express sessions with PostgreSQL store
- **Development**: Hot reload with tsx for server development

The backend implements a RESTful API structure with:
- Route handlers in `/server/routes.ts`
- Database abstraction layer in `/server/storage.ts`
- Middleware for authentication and request logging
- Vite integration for development mode

### Database Design
- **Primary Database**: PostgreSQL via Neon Database
- **Schema Management**: Drizzle Kit for migrations and schema definition
- **Tables**: Users, zones, schedules, schedule steps, zone runs, system status, and notifications
- **Relationships**: Foreign key constraints between schedules, zones, and runs

The schema supports:
- Multi-zone irrigation control with GPIO pin mapping
- Complex scheduling with step-based sequences
- User management with role-based access
- System status tracking and notifications

### Authentication & Authorization
- **Session-based Authentication**: Express sessions with secure cookies
- **Password Storage**: Plain text (development mode) - should be hashed in production
- **User Roles**: Admin and operator role support
- **Middleware**: Custom authentication middleware for protected routes

### External Service Integrations
- **Hardware Control**: Integration with Raspberry Pi GPIO via backend API
- **Real-time Updates**: Polling-based status updates every 5-10 seconds
- **Development Tools**: Replit-specific plugins for enhanced development experience

The system design prioritizes:
- Type safety across the entire stack
- Real-time responsiveness for sprinkler control
- Mobile-optimized user interface
- Extensible architecture for additional zones and features

## External Dependencies

### Core Framework Dependencies
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm**: Type-safe PostgreSQL database operations
- **@neondatabase/serverless**: PostgreSQL database connection
- **express**: Web application framework
- **wouter**: Lightweight React routing

### UI Component Libraries
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe component variants
- **lucide-react**: Modern icon library

### Development & Build Tools
- **vite**: Fast build tool and development server
- **typescript**: Static type checking
- **tsx**: TypeScript execution for Node.js
- **@replit/***: Replit-specific development enhancements

### Optional Services
- **@sendgrid/mail**: Email notifications (optional, disabled if no API key)
- **dropbox**: File storage integration (optional)
- **connect-pg-simple**: PostgreSQL session store
- **@hookform/resolvers**: Form validation with Zod schema validation

The application is designed to work with minimal external dependencies, with most services being optional to ensure core functionality remains available even when external services are unavailable.