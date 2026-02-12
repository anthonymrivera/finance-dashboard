# Finance Dashboard Backend

A secure RESTful API for personal finance management built with Spring Boot and PostgreSQL.

## 📋 Overview

This backend provides secure APIs for managing personal finances including user authentication, account management, and transaction tracking with automatic balance updates.

## ✨ Features

- 🔐 **JWT Authentication** - Secure token-based authentication
- 🔒 **Authorization Checks** - Users can only access their own data
- 💰 **Multi-Account Support** - Checking, savings, credit cards, investments
- 💵 **Automatic Balance Updates** - Real-time balance calculations with transactions
- ✅ **Input Validation** - Bean Validation for data integrity
- 🎯 **Global Exception Handling** - Consistent error responses
- 🔄 **Optimistic Locking** - Prevents concurrent update conflicts
- 📊 **Transaction Management** - ACID compliance for data consistency

## 🛠 Technology Stack

- **Java 17**
- **Spring Boot 3.x**
- **Spring Security** - JWT authentication
- **Spring Data JPA** - Database ORM
- **PostgreSQL** - Relational database
- **Maven** - Build tool
- **BCrypt** - Password hashing
- **Hibernate Validator** - Input validation

## 🚀 Getting Started

### Prerequisites

- Java 17 or higher
- PostgreSQL 13 or higher
- Maven 3.6+

### 1. Database Setup

```sql
-- Create database
CREATE DATABASE financedash;

-- Create user (optional)
CREATE USER financedash_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE financedash TO financedash_user;
```

### 2. Configuration

Create `src/main/resources/application.properties` from the template:

```bash
cp src/main/resources/application.properties.template \
   src/main/resources/application.properties
```

Edit `application.properties`:

```properties
# Database Configuration
spring.datasource.url=jdbc:postgresql://localhost:5432/financedash
spring.datasource.username=your_db_username
spring.datasource.password=your_db_password

# JWT Secret (IMPORTANT: Generate a secure key!)
# Use: openssl rand -base64 32
jwt.secret=your_generated_secret_here

# Server Configuration
server.port=8080
server.address=0.0.0.0

# JPA/Hibernate
spring.jpa.hibernate.ddl-auto=validate
```

**⚠️ IMPORTANT: Generate a secure JWT secret:**
```bash
openssl rand -base64 32
```

### 3. Database Migration

Run the initial migration script:

```bash
psql -U postgres -d financedash -f database-migration.sql
```

Or let Hibernate create tables on first run (development only):
```properties
# Set this ONLY for first run, then change to validate
spring.jpa.hibernate.ddl-auto=create
```

### 4. Build and Run

```bash
# Build the project
mvn clean install

# Run the application
mvn spring-boot:run
```

The API will be available at: `http://localhost:8080`

## 📚 API Documentation

### Base URL
```
http://localhost:8080/api
```

### Authentication Endpoints

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "password": "SecurePassword123!"
}

Response: 200 OK
"User registered"
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "SecurePassword123!"
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Account Endpoints

**All account endpoints require JWT authentication via `Authorization: Bearer <token>` header**

#### Get All Accounts
```http
GET /api/accounts
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": 1,
    "name": "Main Checking",
    "type": "checking",
    "balance": 1000.00,
    "createdAt": "2026-02-11T12:00:00Z",
    "updatedAt": "2026-02-11T12:00:00Z"
  }
]
```

#### Get Single Account
```http
GET /api/accounts/{id}
Authorization: Bearer <token>

Response: 200 OK
Response: 403 Forbidden (if not owned by user)
```

#### Create Account
```http
POST /api/accounts
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Savings Account",
  "type": "savings",
  "balance": 5000.00
}

Response: 201 Created
```

**Validation Rules:**
- `name`: 1-100 characters, required
- `type`: Must be one of: checking, savings, credit, investment
- `balance`: Required, decimal value

#### Update Account
```http
PUT /api/accounts/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "type": "checking",
  "balance": 1500.00
}

Response: 200 OK
Response: 403 Forbidden (if not owned by user)
```

#### Delete Account
```http
DELETE /api/accounts/{id}
Authorization: Bearer <token>

Response: 204 No Content
Response: 400 Bad Request (if account has transactions)
Response: 403 Forbidden (if not owned by user)
```

### Transaction Endpoints

#### Get Transactions for Account
```http
GET /api/transactions?accountId=1
Authorization: Bearer <token>

Response: 200 OK
Response: 403 Forbidden (if account not owned by user)

[
  {
    "id": 1,
    "accountId": 1,
    "amount": 50.00,
    "description": "Grocery shopping",
    "category": "Food",
    "txDate": "2026-02-11",
    "txType": "EXPENSE",
    "createdAt": "2026-02-11T10:00:00Z"
  }
]
```

#### Create Transaction
```http
POST /api/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountId": 1,
  "amount": 50.00,
  "description": "Grocery shopping",
  "category": "Food",
  "txDate": "2026-02-11",
  "txType": "EXPENSE"
}

Response: 201 Created
Response: 403 Forbidden (if account not owned by user)
```

**Validation Rules:**
- `accountId`: Required
- `amount`: Required, positive decimal
- `description`: Required, 1-255 characters
- `category`: Optional, max 80 characters
- `txDate`: Required, valid date
- `txType`: Must be either INCOME or EXPENSE

**Note:** Account balance is automatically updated:
- `EXPENSE` transactions decrease balance
- `INCOME` transactions increase balance

### Error Responses

All errors follow this format:
```json
{
  "timestamp": "2026-02-11T12:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Account name cannot be empty",
  "path": "/api/accounts"
}
```

**Common Status Codes:**
- `400` - Bad Request (validation failed)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (accessing another user's data)
- `404` - Not Found
- `409` - Conflict (e.g., deleting account with transactions)
- `500` - Internal Server Error

## 🏗️ Project Structure

```
src/main/java/com/amrivera/financedash/
├── config/
│   ├── CorsConfig.java              # CORS configuration
│   └── SecurityConfig.java          # Spring Security configuration
├── controller/
│   ├── AccountsController.java      # Account management endpoints
│   ├── AuthController.java          # Authentication endpoints
│   └── TransactionsController.java  # Transaction endpoints
├── dto/
│   ├── AccountRequest.java          # Account creation/update DTOs
│   ├── LoginRequest.java            # Login request DTO
│   ├── TransactionRequest.java      # Transaction creation DTO
│   └── AuthResponse.java            # Authentication response DTO
├── exception/
│   └── GlobalExceptionHandler.java  # Centralized error handling
├── model/
│   ├── Account.java                 # Account entity
│   ├── Transaction.java             # Transaction entity
│   ├── TransactionType.java         # INCOME/EXPENSE enum
│   └── User.java                    # User entity
├── repository/
│   ├── AccountRepository.java       # Account data access
│   ├── TransactionRepository.java   # Transaction data access
│   └── UserRepository.java          # User data access
├── security/
│   ├── JwtAuthenticationFilter.java # JWT filter for requests
│   ├── JwtUtil.java                 # JWT token generation/validation
│   └── UserDetailsServiceImpl.java  # User authentication service
├── service/
│   ├── AccountService.java          # Account business logic
│   └── TransactionService.java      # Transaction business logic
└── FinancedashApplication.java      # Main application class
```

## 🔐 Security Features

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication with configurable expiration
- **BCrypt**: Password hashing with strength 10
- **Authorization Checks**: Every endpoint verifies user owns the data
- **SQL Injection Prevention**: JPA parameterized queries
- **XSS Protection**: Content-Type headers configured

### Input Validation
```java
// Example: Account entity validation
@NotBlank(message = "Account name is required")
@Size(min = 1, max = 100)
private String name;

@Pattern(regexp = "checking|savings|credit|investment")
private String type;

@DecimalMin(value = "0.0", inclusive = false)
private BigDecimal balance;
```

### Data Integrity
- **Transactional Operations**: Balance updates are atomic with transactions
- **Optimistic Locking**: `@Version` prevents concurrent update conflicts
- **Foreign Key Constraints**: Database-level referential integrity
- **Audit Timestamps**: `createdAt` and `updatedAt` on entities

## 🧪 Testing

```bash
# Run all tests
mvn test

# Run specific test class
mvn test -Dtest=AccountServiceTest

# Run with coverage
mvn clean test jacoco:report
```

## 🔧 Development

### Running in Development Mode

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

### Development Configuration

Create `application-dev.properties`:
```properties
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
logging.level.com.amrivera.financedash=DEBUG
jwt.expiration-ms=86400000
```

### Database Migrations

For production, use Flyway or Liquibase:

```xml
<!-- Add to pom.xml -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
```

## 🚀 Production Deployment

### Environment Variables

Set these in production:
```bash
export DB_USERNAME=prod_user
export DB_PASSWORD=secure_password
export JWT_SECRET=$(openssl rand -base64 32)
export SPRING_PROFILES_ACTIVE=prod
```

### Production Configuration

Create `application-prod.properties`:
```properties
spring.jpa.show-sql=false
spring.jpa.hibernate.ddl-auto=validate
logging.level.com.amrivera.financedash=WARN
jwt.expiration-ms=3600000
server.error.include-stacktrace=never
```

### Docker Deployment

```dockerfile
FROM openjdk:17-jdk-slim
WORKDIR /app
COPY target/financedash-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
```

```bash
# Build
docker build -t financedash-backend .

# Run
docker run -p 8080:8080 \
  -e DB_USERNAME=user \
  -e DB_PASSWORD=pass \
  -e JWT_SECRET=secret \
  financedash-backend
```

### Production Checklist

- [ ] Use strong JWT secret (256+ bits)
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS for production origins only
- [ ] Use production database with backups
- [ ] Set `ddl-auto=validate` (never use `create` or `update`)
- [ ] Enable application monitoring (Actuator + Prometheus)
- [ ] Configure proper logging (ELK stack)
- [ ] Set up health checks
- [ ] Implement rate limiting
- [ ] Review security headers
- [ ] Use environment variables for secrets
- [ ] Enable database connection pooling

## 🐛 Troubleshooting

### Common Issues

**Issue: "Failed to connect to database"**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U postgres -d financedash
```

**Issue: "Invalid JWT token"**
- Verify JWT secret matches in `application.properties`
- Check token hasn't expired
- Ensure "Bearer " prefix in Authorization header

**Issue: "403 Forbidden" on transactions**
- Verify account belongs to authenticated user
- Check JWT token is valid
- Ensure using correct account ID

**Issue: Database migration errors**
```bash
# Check current schema
psql -U postgres -d financedash -c "\d accounts"

# Run migration script
psql -U postgres -d financedash -f database-migration.sql
```

**Issue: Port 8080 already in use**
```bash
# Find process using port 8080
lsof -i :8080  # Mac/Linux
netstat -ano | findstr :8080  # Windows

# Kill the process or change port in application.properties
```

## 📊 Database Schema

### Tables

**users**
- `id` BIGSERIAL PRIMARY KEY
- `username` VARCHAR(50) UNIQUE NOT NULL
- `password` VARCHAR NOT NULL (BCrypt hash)
- `created_at` TIMESTAMP NOT NULL
- `last_login` TIMESTAMP
- `is_active` BOOLEAN NOT NULL DEFAULT TRUE

**accounts**
- `id` BIGSERIAL PRIMARY KEY
- `user_id` BIGINT NOT NULL (FK → users.id)
- `name` VARCHAR(100) NOT NULL
- `type` VARCHAR(20) NOT NULL
- `balance` NUMERIC(12,2) NOT NULL
- `created_at` TIMESTAMP NOT NULL
- `updated_at` TIMESTAMP
- `version` BIGINT (optimistic locking)

**transactions**
- `id` BIGSERIAL PRIMARY KEY
- `account_id` BIGINT NOT NULL (FK → accounts.id)
- `amount` NUMERIC(12,2) NOT NULL
- `description` VARCHAR(255) NOT NULL
- `category` VARCHAR(80)
- `tx_date` DATE NOT NULL
- `tx_type` VARCHAR(10) NOT NULL
- `created_at` TIMESTAMP NOT NULL

### Indexes
```sql
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_account_date ON transactions(account_id, tx_date DESC);
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Anthony Rivera**
- GitHub: [@amrivera](https://github.com/amrivera)

## 🙏 Acknowledgments

- Built with Spring Boot
- Secured with Spring Security
- Database powered by PostgreSQL

---

**Built with ❤️ for secure financial tracking**
