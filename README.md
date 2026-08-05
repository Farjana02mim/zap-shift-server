# 🚚 Zap Shift Server

> **Backend API for the Zap Shift Online Delivery Courier Service**

Zap Shift Server is the backend of the Zap Shift Courier Service platform. It provides secure REST APIs for parcel management, user authentication, payment processing, and database operations.

Built with **Node.js**, **Express.js**, **MongoDB**, **Firebase Admin SDK**, and **Stripe**.

---

## 🚀 Features

- 🔐 Firebase Admin Authentication
- 👤 User Authorization & Role Management
- 📦 Parcel Management APIs
- 🚚 Delivery Management
- 💳 Stripe Payment Integration
- 🗄️ MongoDB Database
- 🌐 RESTful API
- 🔒 Secure Environment Variables
- ⚡ Fast and Lightweight Express Server

---

## 🛠️ Tech Stack

### Backend

- Node.js
- Express.js

### Database

- MongoDB

### Authentication

- Firebase Admin SDK

### Payment

- Stripe

### Environment

- dotenv

### Middleware

- CORS

---

## 📂 Project Structure

```
zap-shift-server/
│
├── index.js
├── package.json
├── .env
├── firebase-admin-key.json
└── README.md
```

---

## 🚀 Installation

### Clone the repository

```bash
git clone https://github.com/Farjana02mim/zap-shift-server.git
```

### Navigate to the project

```bash
cd zap-shift-server
```

### Install dependencies

```bash
npm install
```

---

## 🔑 Environment Variables

Create a `.env` file in the project root.

```env
PORT=5000

DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password

STRIPE_SECRET_KEY=your_stripe_secret_key
```

Also add your **Firebase Admin SDK** service account key:

```
firebase-admin-key.json
```

> **Note:** Never upload your `.env` file or Firebase Admin key to GitHub.

---

## ▶️ Run the Server

```bash
node index.js
```

Or, if you use **Nodemon**:

```bash
nodemon index.js
```

The server will run on:

```
http://localhost:5000
```

---

## 📡 API Responsibilities

The backend provides APIs for:

- 👤 User Management
- 📦 Parcel Booking
- 🚚 Delivery Assignment
- 📍 Parcel Tracking
- 💳 Payment Processing
- 📊 Dashboard Statistics
- 🔐 Protected Routes
- 📄 CRUD Operations

---

## 📚 Dependencies

- Express.js
- MongoDB
- Firebase Admin SDK
- Stripe
- dotenv
- cors

---

## 🔒 Security

- Firebase Token Verification
- Protected API Routes
- Environment Variables
- Secure Payment Processing
- CORS Configuration

---

## 🎯 Future Improvements

- JWT Refresh Tokens
- Rate Limiting
- API Documentation (Swagger)
- Email Notifications
- SMS Notifications
- Logging System
- File Upload Support
- Automated Testing

---

## 👩‍💻 Author

**Farjana Akter Mim**

🌐 GitHub: https://github.com/Farjana02mim

---

## 🔗 Related Repository

**Client Repository**

https://github.com/Farjana02mim/zap-shift-client

---

## ⭐ Support

If you found this project helpful, please consider giving it a ⭐ on GitHub.

Your support motivates me to continue learning and building more projects.

---

## 📄 License

This project is licensed under the **MIT License**.
