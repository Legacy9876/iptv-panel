# Custom IPTV Panel

A fully custom IPTV panel built with Node.js, Express, and modern web technologies. This panel provides a complete alternative to Xtream Codes and XUI.one with a modern, responsive interface and comprehensive management features.

## Features

### 🎯 Core Features
- **User Management**: Multi-role system (Admin, Reseller, User)
- **Channel Management**: Add, edit, delete channels with categories
- **Stream Proxy**: Secure stream proxying with connection limits
- **EPG Support**: Electronic Program Guide integration
- **Real-time Monitoring**: Live stream monitoring and statistics
- **Responsive Design**: Modern UI that works on all devices

### 🔧 Admin Features
- **Dashboard**: Real-time system statistics and monitoring
- **User Management**: Create, edit, delete users with role-based access
- **Channel Management**: Bulk channel operations and categorization
- **Category Management**: Hierarchical category system
- **System Settings**: Configurable system parameters
- **Stream Logs**: Detailed streaming analytics

### 👥 User Features
- **Channel Browser**: Search and filter channels by category, quality, language
- **Favorites**: Save favorite channels for quick access
- **Watch History**: Track viewing history and statistics
- **EPG Integration**: View program schedules and information
- **Profile Management**: Update profile and change password

### 🛡️ Security Features
- **JWT Authentication**: Secure token-based authentication
- **Session Management**: Database-backed session tracking
- **Rate Limiting**: Protection against abuse
- **Connection Limits**: Per-user stream connection limits
- **Input Validation**: Comprehensive input sanitization

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn
- SQLite3 (included)

### Quick Start

1. **Clone the repository**
```bash
git clone <repository-url>
cd iptv-panel
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the server**
```bash
npm start
```

4. **Access the application**
- User Panel: http://localhost:3000
- Admin Panel: http://localhost:3000/admin
- Default Admin: admin / admin123

### Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DB_PATH=./database/iptv_panel.db
```

## Configuration

### Database Setup

The application uses SQLite by default. The database will be automatically created on first run with the following tables:

- `users` - User accounts and authentication
- `categories` - Channel categories
- `channels` - Channel information and stream URLs
- `epg` - Electronic Program Guide data
- `user_sessions` - Active user sessions
- `stream_logs` - Stream viewing logs
- `settings` - System configuration

### Adding Channels

You can add channels through the admin panel or directly via API:

```bash
curl -X POST http://localhost:3000/api/admin/channels \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CNN HD",
    "stream_url": "http://example.com/stream.m3u8",
    "category_id": 1,
    "quality": "HD",
    "language": "en"
  }'
```

### Adding Categories

```bash
curl -X POST http://localhost:3000/api/admin/categories \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "News",
    "description": "News channels",
    "sort_order": 1
  }'
```

## API Documentation

### Authentication

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

#### Register (if enabled)
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123"
}
```

### Streams

#### Get Available Streams
```http
GET /api/streams?category_id=1&quality=HD&language=en
Authorization: Bearer YOUR_TOKEN
```

#### Start Stream
```http
GET /api/streams/{streamId}/play
Authorization: Bearer YOUR_TOKEN
```

#### Stream Proxy
```http
GET /api/streams/{streamId}/proxy?log_id={logId}
Authorization: Bearer YOUR_TOKEN
```

### Channels

#### Get Channels
```http
GET /api/channels/search?q=news&category_id=1&quality=HD
Authorization: Bearer YOUR_TOKEN
```

#### Get Channel Details
```http
GET /api/channels/{channelId}
Authorization: Bearer YOUR_TOKEN
```

### EPG

#### Get EPG for Channel
```http
GET /api/epg/channel/{channelId}?date=2024-01-01
Authorization: Bearer YOUR_TOKEN
```

#### Search EPG
```http
GET /api/epg/search?q=news&category=News&date=2024-01-01
Authorization: Bearer YOUR_TOKEN
```

## Admin API

### Users

#### Get All Users
```http
GET /api/admin/users?page=1&limit=20&search=john&role=user&status=active
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Create User
```http
POST /api/admin/users
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "role": "user",
  "max_connections": 3,
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### Channels

#### Get All Channels
```http
GET /api/admin/channels?page=1&limit=20&search=cnn&category_id=1&status=active
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Create Channel
```http
POST /api/admin/channels
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "name": "CNN HD",
  "stream_url": "http://example.com/stream.m3u8",
  "logo_url": "http://example.com/logo.png",
  "category_id": 1,
  "quality": "HD",
  "language": "en",
  "country": "US"
}
```

## Development

### Project Structure

```
iptv-panel/
├── database/
│   └── database.js          # Database initialization and management
├── middleware/
│   ├── auth.js             # Authentication middleware
│   └── admin.js            # Admin authorization middleware
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── users.js            # User management routes
│   ├── streams.js          # Stream handling routes
│   ├── channels.js         # Channel management routes
│   ├── epg.js             # EPG routes
│   └── admin.js           # Admin panel routes
├── public/
│   ├── css/
│   │   └── style.css      # Main stylesheet
│   ├── js/
│   │   ├── app.js         # Main frontend application
│   │   └── admin.js       # Admin panel application
│   ├── index.html         # User panel
│   └── admin.html         # Admin panel
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

### Running in Development

```bash
npm run dev
```

This will start the server with nodemon for automatic reloading on file changes.

### Building for Production

```bash
npm run build
npm start
```

## Security Considerations

1. **Change Default Credentials**: Always change the default admin password
2. **JWT Secret**: Use a strong, unique JWT secret in production
3. **HTTPS**: Use HTTPS in production environments
4. **Rate Limiting**: Configure appropriate rate limits for your use case
5. **Input Validation**: All inputs are validated, but review for your specific needs
6. **Database Security**: Consider using a more robust database for production

## Performance Optimization

1. **Stream Proxy**: The stream proxy is optimized for low latency
2. **Database Indexing**: Add indexes for frequently queried fields
3. **Caching**: Consider implementing Redis for session storage
4. **CDN**: Use a CDN for static assets in production
5. **Load Balancing**: Use multiple server instances for high traffic

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Change port in .env file or use different port
   PORT=3001 npm start
   ```

2. **Database Errors**
   ```bash
   # Delete database file and restart
   rm database/iptv_panel.db
   npm start
   ```

3. **Permission Errors**
   ```bash
   # Ensure proper file permissions
   chmod 755 database/
   ```

4. **Stream Not Working**
   - Check if stream URL is accessible
   - Verify stream format is supported
   - Check network connectivity

### Logs

The application logs to console. For production, consider using a logging service:

```javascript
// Add to server.js
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting section

## Roadmap

- [ ] Multi-language support
- [ ] Advanced EPG features
- [ ] Mobile app
- [ ] API rate limiting improvements
- [ ] Advanced analytics
- [ ] Backup and restore functionality
- [ ] Plugin system
- [ ] Docker support 