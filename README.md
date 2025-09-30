# Logistics PR Tracker - Android App

A comprehensive Android application for tracking Purchase Requisitions (PRs) with multi-user support and real-time synchronization with an online server.

## Features

### Mobile App Features
- **Multi-user Authentication**: Secure login system with role-based access (Admin/Viewer)
- **Offline Support**: Local SQLite database with automatic sync when online
- **Real-time Updates**: Socket.io integration for live updates across devices
- **File Upload**: Parse Excel files to create new PRs
- **PR Management**: View, update, and track purchase requisitions
- **Search & Filter**: Advanced search and filtering capabilities
- **Responsive Design**: Optimized for mobile devices

### Server Features
- **RESTful API**: Complete backend API for all operations
- **Real-time Communication**: WebSocket support for live updates
- **Data Synchronization**: Automatic sync between mobile app and server
- **User Session Management**: Track active users and sessions
- **File Processing**: Server-side Excel file parsing
- **Change Logging**: Complete audit trail of all changes

## Technology Stack

### Mobile App
- **React Native**: Cross-platform mobile development
- **React Navigation**: Navigation management
- **React Native Paper**: Material Design components
- **SQLite**: Local database storage
- **Axios**: HTTP client for API communication
- **Socket.io Client**: Real-time communication

### Backend Server
- **Node.js**: Server runtime
- **Express.js**: Web framework
- **SQLite**: Database
- **Socket.io**: Real-time communication
- **JWT**: Authentication tokens
- **Multer**: File upload handling
- **XLSX**: Excel file processing

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- React Native development environment
- Android Studio (for Android development)
- Git

### Mobile App Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd logistics-pr-tracker-mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install iOS dependencies (if developing for iOS)**
   ```bash
   cd ios && pod install && cd ..
   ```

4. **Configure the API endpoint**
   - Update `src/services/ApiService.ts`
   - Replace `baseURL` with your server URL

5. **Run the app**
   ```bash
   # For Android
   npm run android
   
   # For iOS
   npm run ios
   ```

### Server Setup

1. **Navigate to server directory**
   ```bash
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**
   ```env
   PORT=3000
   JWT_SECRET=your-secret-key
   NODE_ENV=development
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/validate` - Validate session
- `POST /api/auth/heartbeat` - Update user heartbeat

### Purchase Requisitions
- `GET /api/prs` - Get all PRs
- `GET /api/prs/:id` - Get specific PR
- `POST /api/prs` - Create new PR
- `PUT /api/prs/:id` - Update PR
- `DELETE /api/prs/:id` - Delete PR
- `PUT /api/prs/:prId/items/:itemId` - Update PR item

### File Upload
- `POST /api/upload` - Upload and parse Excel file

### Synchronization
- `POST /api/sync` - Sync changes
- `GET /api/sync/changes` - Get changes since timestamp

### Users
- `GET /api/users/active` - Get active users

## Database Schema

### Mobile App (SQLite)
- `purchase_requisitions` - PR master data
- `pr_items` - PR line items
- `sync_queue` - Pending sync operations

### Server (SQLite)
- `user_sessions` - Active user sessions
- `purchase_requisitions` - PR master data
- `pr_items` - PR line items
- `change_log` - Change history for sync
- `sync_status` - Sync status tracking

## User Roles

### Admin
- Upload new PRs
- Update PR items
- Delete PRs
- View all data
- Manage system

### Viewer
- View PRs and items
- Search and filter
- Read-only access

## Synchronization

The app implements a robust synchronization system:

1. **Offline First**: All operations work offline
2. **Automatic Sync**: Syncs when network is available
3. **Conflict Resolution**: Server-side conflict resolution
4. **Change Tracking**: Complete audit trail
5. **Real-time Updates**: Live updates via WebSocket

## Security Features

- JWT-based authentication
- Role-based access control
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection

## Development

### Adding New Features

1. **Mobile App**
   - Add new screens in `src/screens/`
   - Create services in `src/services/`
   - Update navigation in `src/App.tsx`

2. **Server**
   - Add routes in `src/routes/`
   - Create services in `src/services/`
   - Update database schema if needed

### Testing

```bash
# Mobile app
npm test

# Server
cd server && npm test
```

### Building for Production

```bash
# Android APK
npm run build

# Server
cd server && npm start
```

## Deployment

### Mobile App
- Build APK/AAB for Google Play Store
- Configure production API endpoints
- Test on various devices

### Server
- Deploy to cloud provider (AWS, Google Cloud, etc.)
- Configure production database
- Set up SSL certificates
- Configure environment variables

## Troubleshooting

### Common Issues

1. **Network connectivity issues**
   - Check server URL configuration
   - Verify network permissions

2. **Database issues**
   - Clear app data and restart
   - Check database initialization

3. **Sync problems**
   - Force sync from settings
   - Check server connectivity

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check documentation

---

This Android app provides a complete solution for logistics PR tracking with multi-user support and real-time synchronization capabilities.