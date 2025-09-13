

# MedLink Frontend

React-based frontend for the MedLink telehealth platform, built with Vite and modern React features.

## 🚀 Tech Stack

- **React 19.1.1** - Modern React with hooks
- **Vite 7.1.2** - Fast build tool and dev server
- **React Router DOM 7.8.2** - Client-side routing
- **Recharts 3.1.2** - Data visualization and charts
- **Lottie React 2.4.1** - Animations
- **Socket.IO Client 4.7.2** - Real-time communication

## 📁 Project Structure

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── CallModal.jsx          # Video call modal component
│   │   └── ...
│   ├── doctorPages/
│   │   ├── Dashboard.jsx          # Doctor dashboard with patient metrics
│   │   ├── Messages.jsx           # Doctor-patient messaging
│   │   ├── Patients.jsx           # Patient list and management
│   │   └── Profile.jsx            # Doctor profile settings
│   ├── patientPages/
│   │   ├── Dashboard.jsx          # Patient health dashboard
│   │   ├── Messages.jsx           # Patient-doctor messaging
│   │   └── Profile.jsx            # Patient profile settings
│   ├── App.jsx                    # Main app component with routing
│   ├── main.jsx                   # React app entry point
│   └── index.css                  # Global styles
├── index.html                     # HTML template
├── package.json                   # Dependencies and scripts
└── vite.config.js                 # Vite configuration
```

## 🏥 Pages Overview

### Authentication
- **Login/Register** - User authentication with role-based routing

### Doctor Pages
- **Dashboard** - View patient health metrics, trends, and alerts
- **Patients** - Manage patient list and view detailed health data
- **Messages** - Secure messaging with patients, real-time chat
- **Profile** - Doctor profile management and settings

### Patient Pages
- **Dashboard** - Personal health metrics and trends visualization
- **Messages** - Chat with assigned doctors, video call functionality
- **Profile** - Patient profile and health information management

### Shared Components
- **CallModal** - Video call interface with accept/reject functionality
- **Navigation** - Role-based navigation components
- **Charts** - Health data visualization components

## 🔧 Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

## 🌐 API Integration

The frontend communicates with the backend API at `http://localhost:3001` for:

- **Authentication** - JWT-based login/register
- **Health Data** - Real-time and aggregated health metrics
- **Messaging** - Doctor-patient communication
- **Video Calls** - Call initiation and management
- **User Management** - Profile and settings

## 📊 Key Features

### Real-Time Health Monitoring
- Heart rate, respiratory rate, SpO₂ tracking
- Interactive charts with Recharts
- Trend analysis and anomaly detection

### Secure Messaging
- Real-time chat with Socket.IO
- Message history and conversation management
- Typing indicators and read receipts

### Video Calling
- WebRTC-based video calls
- Call notifications and modal interface
- Accept/reject call functionality

### Responsive Design
- Mobile-first approach
- Dark theme with medical aesthetics
- Smooth animations with Lottie

## 🔐 Authentication Flow

1. User logs in with email/password
2. JWT token stored in localStorage
3. Role-based routing (doctor/patient)
4. Protected routes with authentication middleware
5. Automatic token refresh handling

## 📱 Responsive Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## 🎨 Design System

### Colors
- **Primary**: `#00fbcd` (Teal)
- **Background**: `#1a1a1a` (Dark)
- **Text**: `rgba(255, 255, 255, 0.9)` (Light)
- **Accent**: `#ff6b6b` (Red for alerts)

### Typography
- **Font Family**: System fonts (San Francisco, Segoe UI, etc.)
- **Sizes**: 12px - 24px with responsive scaling

## 🚀 Deployment

```bash
# Build for production
npm run build

# Deploy to your hosting platform
# (Vercel, Netlify, AWS S3, etc.)
```

## 📈 Performance Optimizations

- **Code Splitting** - Route-based lazy loading
- **Bundle Optimization** - Vite's built-in optimizations
- **Image Optimization** - Lazy loading and compression
- **Caching** - Service worker for offline functionality

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run e2e tests (when implemented)
npm run test:e2e
```

## 🔄 State Management

- **React Hooks** - useState, useEffect for local state
- **Context API** - User authentication state
- **Local Storage** - Token and user preferences
- **Socket.IO** - Real-time state synchronization

## 📦 Build Output

```
dist/
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── [other-assets]
├── index.html
└── favicon.ico
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Follow the existing code style and patterns
4. Test your changes thoroughly
5. Submit a pull request

## 📄 License

MIT License - see the main project README for details.