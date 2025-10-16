# 🚀 Quick Start Guide

## Prerequisites
- Docker Desktop installed and running
- Ports available: 3000, 3001, 5432, 6379, 8080, 8081

## Start the Application

```powershell
# Clone and navigate to project
cd d:\work\loopmsq

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

## Access Points

| Service | URL | Description |
|---------|-----|-------------|
| **Admin Panel** | http://localhost:3001 | Frontend dashboard |
| **API** | http://localhost:3000/api/v1 | Backend API |
| **API Docs** | http://localhost:3000/api/v1/docs | Swagger documentation |
| **Adminer** | http://localhost:8080 | PostgreSQL manager |
| **Redis Commander** | http://localhost:8081 | Redis manager |

## Default Credentials

### Admin Account
```
Email: admin@example.com
Password: StrongPass#2025
```

### Database (Adminer)
```
System: PostgreSQL
Server: postgres
Username: postgres
Password: password
Database: booking_platform
```

## Common Commands

```powershell
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop all
docker-compose down

# Rebuild and start
docker-compose up -d --build

# View specific service logs
docker logs booking-backend -f
docker logs booking-admin -f
```

## Health Check

```powershell
# API health
curl http://localhost:3000/api/v1/health

# Or visit in browser
http://localhost:3000/api/v1/health
```

## Troubleshooting

**If build fails:**
1. Check Docker is running
2. Try: `docker-compose build --no-cache`
3. See `DOCKER_TROUBLESHOOTING.md` for detailed help

**If containers won't start:**
```powershell
docker-compose down
docker-compose up -d
docker-compose logs
```

**Port already in use:**
```powershell
# Find process on port
netstat -ano | findstr :3000

# Kill process (use PID from above)
taskkill /PID <process-id> /F
```

## Development

### Frontend Development
```powershell
cd apps/admin
npm install
npm run dev
# Dev server on http://localhost:5173
```

### Backend Development
```powershell
cd apps/api
npm install
npm run start:dev
# API on http://localhost:3000
```

## Architecture

```
┌─────────────────┐
│  Admin Panel    │ (React + Vite)
│  :3001          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  NestJS API     │ (Backend)
│  :3000          │
└────┬────────┬───┘
     │        │
     ▼        ▼
┌─────────┐ ┌─────────┐
│PostgreSQL│ │  Redis  │
│  :5432   │ │  :6379  │
└──────────┘ └─────────┘
```

## API Routes Overview

| Category | Endpoint | Description |
|----------|----------|-------------|
| Auth | `/auth/*` | Authentication & registration |
| Users | `/users/*` | User management |
| Content | `/content/*` | Branches & halls |
| Bookings | `/bookings/*` | Booking management |
| Payments | `/payments/*` | Payment processing (admin list/detail available) |
| Trips | `/trips/*` | School trips |
| Events | `/events/*` | Special events |
| Loyalty | `/loyalty/*` | Loyalty program (me, admin user summary, wallets list/adjust, rules) |
| Referrals | `/referrals/*` | Codes, attribution, earnings, approve (admin) |
| Support | `/support/*` | Support tickets |
| Admin | `/admin/*` | Admin CMS (banners, offers, coupons, packages) |

## Database Schema

Main tables:
- `users` - User accounts
- `branches` - Branch locations
- `halls` - Entertainment halls
- `bookings` - Bookings & reservations
- `tickets` - QR code tickets
- `payments` - Payment records
- `loyalty_transactions` - Loyalty points
- `support_tickets` - Support system
- `banners` - Marketing banners
- `offers` - Special offers
- `coupons` - Discount coupons
- `event_packages` - Event packages

## Next Steps

1. ✅ Verify all services are running: `docker-compose ps`
2. ✅ Login to admin panel: http://localhost:3001
3. ✅ Explore API docs: http://localhost:3000/api/v1/docs
4. ✅ Review project phases in `adminfolder/`
5. ✅ Start developing!

## Support

- **Docker Issues**: See `DOCKER_TROUBLESHOOTING.md`
- **Build Instructions**: See `BUILD_INSTRUCTIONS_AR.md`
- **Success Summary**: See `SUCCESS_SUMMARY.md`
- **Project Roadmap**: See `adminfolder/README.md`

---

**Status**: ✅ All systems operational!

**Last Updated**: October 14, 2025

