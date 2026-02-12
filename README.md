# Angular Parking Lot Reservation System - Coding Challenge

## Overview

This coding challenge evaluates your ability to build a functional Angular application following modern best practices. You'll create a parking lot reservation system with multiple pages, state management, and API integration.

**Estimated Duration:** 2-3 hours

---

## Objective

Build an Angular application that allows users to:

- Create new reservations
- Edit existing reservations
- Delete reservations

---

## Requirements

### Pages to Build

#### 1. **Dashboard Page** (`/dashboard`)

- Display a list of all existing reservations in a table or card layout
- Show key details: Reservation ID, Lot Name, Space Number, User Name, Check-in Date, Check-out Date, Status
- Add navigation links to create, edit, or delete reservations
- Display empty state message when no reservations exist
- Include search/filter functionality (optional but recommended)

#### 2. **Create Reservation Page** (`/create`)

- Form with fields:
  - Parking Lot (dropdown)
  - Space Number (dropdown - filtered by selected lot)
  - User Name (text input)
  - Check-in Date & Time (datetime picker)
  - Check-out Date & Time (datetime picker)
  - Special Requirements (text area - optional)
- Form validation (required fields, date logic: checkout > checkin)
- Success/error notifications after submission
- Navigation back to dashboard on success

#### 3. **Edit Reservation Page** (`/edit/:id`)

- Pre-populate form with existing reservation data
- Same form fields as Create page
- Validation rules apply
- Success/error notifications
- Option to cancel and return to dashboard
- Handle case where reservation ID doesn't exist

#### 4. **Delete Functionality**

- Delete button on dashboard list items or edit page
- Confirmation dialog before deletion
- Success notification after deletion
- Return to dashboard

---

## Technical Requirements

### Architecture & Code Quality

- ✅ Use **Reactive Forms** for all form inputs
- ✅ Implement a **service-based architecture** with separation of concerns
- ✅ Use **RxJS Observables** for data streams (avoid direct Promise usage where possible)
- ✅ Proper **error handling** with user-friendly messages
- ✅ Clean, readable code following Angular style guide

### State Management

- ✅ Use a **ReservationService** to manage API calls and business logic
- ✅ Consider using a simple shared service or NgRx for state (NgRx is a plus, not required)
- ✅ Proper **subscription management** (unsubscribe in ngOnDestroy or use `async` pipe)

### Performance & Best Practices

- ✅ Use `OnPush` change detection strategy (recommended)
- ✅ Lazy load the reservation module if possible
- ✅ Use smart/dumb component pattern where appropriate
- ✅ Implement `trackBy` function in \*ngFor loops

### Validation

- ✅ Required field validation
- ✅ Date validation (checkout must be after checkin)
- ✅ Display validation error messages to users
- ✅ Disable submit button until form is valid

### UI/UX

- ✅ Responsive design (mobile-friendly)
- ✅ Clear visual feedback (loading states, success/error messages)
- ✅ Accessible forms with proper labels and ARIA attributes
- ✅ Professional styling (use Angular Material or Bootstrap - your choice)

---

## Mock API Specification

Use a mock HTTP service or json-server. Expected endpoints:

```
GET    /api/reservations           - Get all reservations
GET    /api/reservations/:id       - Get single reservation
POST   /api/reservations           - Create new reservation
PUT    /api/reservations/:id       - Update reservation
DELETE /api/reservations/:id       - Delete reservation
GET    /api/parking-lots           - Get all parking lots
GET    /api/parking-lots/:id/spaces - Get available spaces
```

---

## Evaluation Criteria

### What We're Looking For

| Criteria                                       | Weight |
| ---------------------------------------------- | ------ |
| Functionality (all features work as specified) | 30%    |
| Code Quality & Architecture                    | 25%    |
| Angular Best Practices                         | 20%    |
| UX/UI & Error Handling                         | 15%    |
| Testing (unit tests for services/components)   | 10%    |

### Key Areas We'll Assess

- How well you structure components and services
- Effective use of RxJS Observables
- Proper form handling and validation
- State management approach
- Error handling and edge cases
- Code readability and maintainability

---

## Deliverables

1. ✅ Working Angular application with all 3+ pages
2. ✅ Clean, organized project structure
3. ✅ Functional forms with validation
4. ✅ (Optional) Unit tests for services
5. ✅ (Optional) README explaining your architecture decisions

---

## Bonus Points

- 🌟 Implement unit tests using Jasmine/Karma
- 🌟 Add real-time availability updates (WebSockets simulation)
- 🌟 Implement pagination or virtual scrolling for large lists
- 🌟 Add confirmation dialogs using Angular Material Dialog
