# Finance Dashboard

> A full-stack personal finance tracking application with React frontend and Spring Boot backend.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-green.svg)

## 📋 Overview

Finance Dashboard is a secure, full-stack web application for managing personal finances. Track accounts, record transactions, and monitor your financial health with a modern, intuitive interface.

### ✨ Features

- 🔐 **Secure Authentication** - JWT-based user authentication
- 💰 **Account Management** - Manage multiple accounts (checking, savings, credit, investment)
- 📊 **Transaction Tracking** - Record income and expenses with categories
- 💵 **Automatic Balance Updates** - Real-time balance calculations
- 📱 **Responsive Design** - Modern, mobile-friendly UI
- 🔒 **Data Privacy** - Users can only access their own data

## 🏗️ Project Structure

```
finance-dashboard/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/
│   │   └── App.jsx
│   ├── package.json
│   └── README.md
│
├── backend/               # Spring Boot REST API
│   ├── src/
│   │   └── main/
│   │       ├── java/
│   │       │   └── com/amrivera/financedash/
│   │       │       ├── controller/
│   │       │       ├── model/
│   │       │       ├── repository/
│   │       │       ├── service/
│   │       │       └── security/
│   │       └── resources/
│   │           └── application.properties.template
│   ├── pom.xml
│   └── README.md
│
├── .gitignore            # Git ignore rules
└── README.md            # This file
```

## 🚀 Quick Start

### Prerequisites

- **Backend:**
  - Java 17+
  - PostgreSQL 13+
  - Maven 3.6+

- **Frontend:**
  - Node.js 16+
  - npm or yarn

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/finance-dashboard.git
cd finance-dashboard
```

### 2. Backend Setup

```bash
cd backend

# Create database
createdb financedash

# Configure application
cp src/main/resources/application.properties.template \
   src/main/resources/application.properties

# Edit application.properties with your credentials
nano src/main/resources/application.properties

# Run the backend
mvn spring-boot:run
```

Backend will run on: `http://localhost:8080`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend will run on: `http://localhost:5173`

### 4. Access the Application

Open your browser and navigate to `http://localhost:5173`

## 🛠️ Tech Stack

### Backend
- **Framework:** Spring Boot 3.x
- **Language:** Java 17
- **Database:** PostgreSQL
- **Authentication:** JWT (JSON Web Tokens)
- **Security:** Spring Security, BCrypt
- **Build Tool:** Maven
- **ORM:** Spring Data JPA / Hibernate

### Frontend
- **Framework:** React 18
- **Language:** JavaScript (ES6+)
- **Styling:** CSS / Tailwind CSS
- **HTTP Client:** Axios
- **Routing:** React Router
- **Build Tool:** Vite

## 📚 Documentation

- [Backend Documentation](./financedash/README.md) - API endpoints, security, and backend setup
- [Frontend Documentation](./financedash-frontend/README.md) - Component structure and frontend setup
- [API Reference](./financedash/API.md) - Detailed API endpoint documentation

## 🔒 Security

This project implements several security best practices:

- ✅ Password hashing with BCrypt
- ✅ JWT token-based authentication
- ✅ Authorization checks on all endpoints
- ✅ Input validation
- ✅ SQL injection prevention via JPA
- ✅ CORS configuration
- ✅ Optimistic locking for concurrency

### Important Security Notes

⚠️ **Never commit sensitive files:**
- `backend/src/main/resources/application.properties`
- `frontend/.env`

✅ **Use template files instead:**
- `backend/src/main/resources/application.properties.template`
- `frontend/.env.example`

## 🧪 Testing

### Backend Tests
```bash
cd backend
mvn test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🚢 Deployment

### Backend Deployment

**Using Docker:**
```bash
cd backend
docker build -t finance-backend .
docker run -p 8080:8080 finance-backend
```

**Environment Variables:**
```bash
export DB_USERNAME=your_db_user
export DB_PASSWORD=your_db_password
export JWT_SECRET=$(openssl rand -base64 32)
```

### Frontend Deployment

```bash
cd frontend
npm run build
# Deploy the 'build' folder to your hosting service
```

## 📝 Environment Variables

### Backend (application.properties)
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/financedash
spring.datasource.username=${DB_USERNAME:postgres}
spring.datasource.password=${DB_PASSWORD}
jwt.secret=${JWT_SECRET}
jwt.expiration-ms=86400000
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:8080
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Your Name**
- GitHub: [@anthonymrivera](https://github.com/anthonymrivera)
- Email: anthonymrivera824@gmail.com

## 🙏 Acknowledgments

- Built with Spring Boot and React
- Inspired by modern personal finance apps
- Thanks to the open-source community

## 📞 Support

For support, email anthonymrivera824@gmail.com or open an issue on GitHub.

---

**Made with ❤️ for better financial tracking**
