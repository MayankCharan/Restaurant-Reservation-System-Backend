# Restaurant Reservation System - Backend

REST API for managing restaurant reservations, authentication, and administration.

---

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- bcrypt
- dotenv

---

## Features

### Authentication

- Register
- Login
- JWT Authentication

### Reservations

- Create reservation
- Cancel reservation
- View reservations
- Availability validation

### Admin

- View all reservations
- Manage reservation status
- Manage availability

---

# Setup Instructions

## Prerequisites

- Node.js (v18+)
- MongoDB

## Installation

```bash
git clone <repository-url>

cd server

npm install
```

Create a `.env` file:

```env
PORT=5000

MONGO_URI=your_mongodb_connection

JWT_SECRET=your_secret_key
```

Run the server:

```bash
npm run dev
```

or

```bash
npm start
```

API runs at:

```
http://localhost:5000
```

---

# Assumptions Made

- MongoDB is available.
- JWT is used for authentication.
- Every reservation belongs to exactly one user.
- Reservation requests always pass through backend validation.
- Admin accounts are created separately or seeded.

---

# Reservation & Availability Logic

Reservation flow:

1. User sends reservation request.
2. Authentication middleware validates JWT.
3. Requested date and time are checked.
4. Existing reservations for that slot are queried.
5. Capacity/availability rules are validated.
6. If space exists:
   - Reservation is created.
7. Otherwise:
   - API returns an availability error.

This guarantees that unavailable slots cannot be booked.

---

# Role-Based Access

## User

Permissions:

- Register
- Login
- Create reservation
- View own reservations
- Cancel own reservation

Users cannot:

- View other users' reservations
- Access admin routes
- Modify availability

---

## Admin

Permissions:

- View all reservations
- Update reservation status
- Manage restaurant availability
- Access admin endpoints

Role verification middleware protects all admin routes.

---

# Known Limitations

- No real-time reservation locking.
- No payment processing.
- No email notifications.
- Limited logging.
- No rate limiting.
- Basic error handling.

---

# Areas for Improvement

Future enhancements:

- WebSocket support
- Redis caching
- Background jobs
- Email reminders
- Payment gateway
- Reservation waitlist
- API documentation (Swagger)
- Docker support
- Automated testing
- Monitoring and logging
- Rate limiting
- CI/CD pipeline

---

# API Structure

```
/api/auth
/api/users
/api/reservations
/api/admin
```

---

# Environment Variables

```
PORT=

MONGO_URI=

JWT_SECRET=
```

---

# Security

- Password hashing using bcrypt
- JWT Authentication
- Protected routes
- Role-based authorization
- Input validation

---

# License

For assessment purposes only.
