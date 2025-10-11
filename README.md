# Booking Platform Backend

A comprehensive NestJS backend system for a booking platform with PostgreSQL database, Redis caching, JWT authentication, and modular architecture.

## Features

- **Authentication & Authorization**: OTP-based authentication, JWT tokens, Role-Based Access Control (RBAC)
- **User Management**: User profiles, staff accounts, permissions management
- **Content Management**: Branches, halls, activities, pricing rules with bilingual support
- **Booking System**: Core booking creation, slot reservation, inventory management, ticket generation
- **Payment Processing**: Payment gateway integration, webhook handling, refund logic
- **Loyalty & Wallet**: Points management, wallet balances, promotional codes
- **Operational Features**: QR code validation, attendance marking, staff functionalities
- **School Trips**: Bulk booking requests, Excel file processing, approval workflow
- **Notifications**: SMS/Email/Push notification queuing with Redis
- **Support System**: Support tickets, chat functionality, reviews and ratings

## Technology Stack

- **Backend Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Caching/Messaging**: Redis
- **ORM**: TypeORM
- **Authentication**: JWT (JSON Web Tokens)
- **API Format**: RESTful JSON
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker & Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd booking-backend
   ```

2. **Quick Setup (Recommended)**
   
   **For Windows:**
   ```bash
   scripts\dev-setup.bat
   ```
   
   **For Linux/Mac:**
   ```bash
   chmod +x scripts/dev-setup.sh
   ./scripts/dev-setup.sh
   ```

3. **Manual Setup**
   
   a. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env file with your configuration
   ```
   
   b. **Start infrastructure services**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```
   
   c. **Install dependencies and build**
   ```bash
   npm install
   npm run build
   ```
   
   d. **Start the development server**
   ```bash
   npm run start:dev
   ```

4. **Full Docker Setup (Production-like)**
   ```bash
   docker-compose up -d
   ```

   This will start:
   - PostgreSQL database on port 5432
   - Redis on port 6379
   - NestJS application on port 3000
   - Adminer (database management) on port 8080
   - Redis Commander on port 8081

### API Documentation

Once the application is running, visit:
- **Swagger UI**: http://localhost:3000/api/v1/docs
- **Health Check**: http://localhost:3000/api/v1/health

## Project Structure

```
src/
├── common/                 # Shared utilities, decorators, guards
│   ├── decorators/        # Custom decorators (roles, current-user)
│   ├── filters/           # Exception filters
│   └── guards/            # Authorization guards
├── config/                # Configuration files
│   ├── app.config.ts      # Application configuration
│   ├── database.config.ts # Database configuration
│   ├── jwt.config.ts      # JWT configuration
│   └── redis.config.ts    # Redis configuration
├── database/              # Database entities and migrations
│   └── entities/          # TypeORM entities
├── modules/               # Feature modules
│   ├── auth/              # Authentication module
│   ├── bookings/          # Booking management
│   ├── content/           # Branches and halls management
│   └── users/             # User management
├── utils/                 # Utility services
│   ├── encryption.util.ts # Encryption service
│   ├── qr-code.service.ts # QR code generation
│   └── redis.service.ts   # Redis operations
├── app.module.ts          # Main application module
└── main.ts                # Application entry point
```

## API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /otp/send` - Send OTP for phone verification
- `POST /otp/verify` - Verify OTP and login/register
- `POST /staff/login` - Staff/admin login
- `GET /me` - Get current user profile
- `POST /refresh` - Refresh access token

### Users (`/api/v1/users`)
- `POST /staff` - Create staff user (Admin only)
- `GET /` - Get all users (Admin/Staff only)
- `GET /stats` - Get user statistics (Admin only)
- `GET /profile` - Get current user profile
- `PUT /profile` - Update current user profile

### Content (`/api/v1/content`)
- `POST /branches` - Create branch (Admin only)
- `GET /branches` - Get all branches
- `GET /branches/:id` - Get branch by ID
- `POST /halls` - Create hall (Admin only)
- `GET /halls` - Get all halls
- `GET /halls/:id/availability` - Check hall availability
- `GET /halls/:id/pricing` - Calculate hall pricing

### Bookings (`/api/v1/bookings`)
- `POST /quote` - Get booking quote
- `POST /` - Create booking
- `GET /` - Get user bookings
- `GET /:id` - Get booking details
- `GET /:id/tickets` - Get booking tickets
- `POST /:id/cancel` - Cancel booking
- `POST /staff/scan` - Scan ticket QR code (Staff only)

## Environment Variables

Key environment variables (see `.env.example` for complete list):

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=booking_platform

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# Application
PORT=3000
NODE_ENV=development
API_PREFIX=api/v1
```

## Development

### Available Scripts

```bash
# Development
npm run start:dev          # Start in development mode with hot reload
npm run start:debug        # Start in debug mode

# Production
npm run build              # Build the application
npm run start:prod         # Start in production mode

# Testing
npm run test               # Run unit tests
npm run test:e2e           # Run end-to-end tests
npm run test:cov           # Run tests with coverage

# Linting
npm run lint               # Run ESLint
npm run format             # Format code with Prettier
```

### Database Management

Access database management tools:
- **Adminer**: http://localhost:8080 (when using Docker Compose)
- **Redis Commander**: http://localhost:8081 (when using Docker Compose)

### Adding New Features

1. Create a new module in `src/modules/`
2. Define entities in `src/database/entities/`
3. Create DTOs for request/response validation
4. Implement service logic with proper error handling
5. Add controller endpoints with Swagger documentation
6. Update the main `AppModule` to include your new module

## Security Features

- **Data Encryption**: Sensitive PII encrypted at rest
- **Rate Limiting**: Global and per-endpoint rate limiting
- **Input Validation**: Strict validation using class-validator
- **RBAC**: Role-based access control
- **JWT Authentication**: Secure token-based authentication
- **Audit Logging**: Comprehensive logging of administrative actions

## Performance Features

- **Redis Caching**: Intelligent caching for frequently accessed data
- **Database Indexing**: Optimized database queries with proper indexing
- **Connection Pooling**: Efficient database connection management
- **Async Processing**: Background job processing for heavy operations

## Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set production environment variables**
   ```bash
   export NODE_ENV=production
   # Set other production variables
   ```

3. **Run database migrations**
   ```bash
   npm run migration:run
   ```

4. **Start the application**
   ```bash
   npm run start:prod
   ```

Or use Docker:
```bash
docker build -t booking-backend .
docker run -p 3000:3000 booking-backend
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.