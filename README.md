# Gemini Screen Share

A real-time screen sharing application that uses Google's Gemini 2.0 Vision model to analyze and interact with shared screen content.

## Features

- Real-time screen sharing through browser
- Integration with Gemini 2.0 Vision model for screen content analysis
- WebSocket-based communication
- Voice input support
- Single command startup

## Prerequisites

- Python 3.8+
- Google API Key for Gemini (set as environment variable `GOOGLE_API_KEY`)

## Installation

1. Clone the repository
2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Local Development

Start the application with a single command:
```bash
python server.py
```

Then open your browser to:
```
http://localhost:8080
```

## Remote Deployment

1. Set up your server with Nginx
2. Update the `nginx.conf` with your domain and SSL certificate paths
3. Install dependencies and start the application server
4. Configure your firewall to allow traffic on ports 80 and 443

## Deployment Guide

### Option 1: Hostinger VPS + Coolify Deployment

#### 1. VPS Setup on Hostinger
1. Log into your Hostinger account
2. Purchase or select your VPS plan
3. Select Ubuntu (20.04 or later) as your operating system
4. Note your VPS IP address, root password, and SSH details

#### 2. Initial VPS Configuration
```bash
# SSH into your VPS
ssh root@your_vps_ip

# Update system packages
apt update && apt upgrade -y

# Create a new sudo user (replace 'username')
adduser username
usermod -aG sudo username

# Set up basic firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw allow 3000
ufw enable
```

#### 3. Install Coolify
```bash
# SSH as your new user
ssh username@your_vps_ip

# Install Coolify
wget -q https://get.coolify.io -O install.sh
sudo bash ./install.sh
```

#### 4. Configure Coolify
1. Access Coolify dashboard: `http://your_vps_ip:3000`
2. Complete initial setup:
   - Create admin account
   - Configure your domain settings
   - Set up SSL certificates

#### 5. Deploy Application
1. In Coolify dashboard:
   - Click "New Resource" → "Application"
   - Select "Docker" as deployment method
   - Connect your Git repository
   - Configure build settings:
     ```
     Build Command: docker build -t gemini-screen .
     Port: 8080
     ```
   - Set environment variables:
     ```
     GOOGLE_API_KEY=your_gemini_api_key
     ```

2. Configure domain:
   - Add your domain in Hostinger's DNS panel
   - Point A record to your VPS IP
   - Enable HTTPS in Coolify

#### 6. Post-Deployment
1. Verify WebSocket connection
2. Test screen sharing (requires HTTPS)
3. Monitor application logs in Coolify dashboard

## Deployment Architecture

This application uses a two-tier deployment strategy combining Hostinger VPS for infrastructure and Coolify for PaaS capabilities.

### Hostinger Provides:
- Virtual Private Server (VPS) infrastructure
- Dedicated IP address
- Root access and full server control
- DDoS protection
- DNS management
- Network stability and uptime
- Server resource monitoring
- Automated backup solutions
- 24/7 infrastructure support
- Scalable resources (CPU, RAM, Storage)

### Coolify Provides:
- Container orchestration (Docker-based)
- Automated deployment pipeline
- Zero-downtime deployments
- SSL certificate management
- Reverse proxy configuration
- WebSocket handling
- Environment variable management
- Application health monitoring
- Log aggregation and viewing
- One-click rollbacks
- Git integration
- Build cache optimization
- Service discovery
- Database management options
- Real-time deployment logs
- Custom domain management
- Resource usage metrics

### Architecture Benefits
- **Cost Effective**: Pay only for VPS resources, not premium PaaS pricing
- **No Vendor Lock-in**: Full control over infrastructure and deployment
- **Security**: All data remains on your VPS
- **Flexibility**: Easy migration and scaling options
- **Developer Experience**: Heroku-like deployment with full infrastructure control

## Troubleshooting

#### Common Issues
1. WebSocket Connection Failed
   - Check firewall settings
   - Verify SSL configuration
   - Ensure domain is properly configured

2. Screen Sharing Not Working
   - Confirm HTTPS is enabled
   - Check browser permissions
   - Verify WebSocket proxy settings

3. Application Not Starting
   - Check environment variables
   - Review Docker build logs
   - Verify port configurations

#### Useful Commands
```bash
# Check application logs
docker logs container_name

# Restart Coolify
systemctl restart coolify

# Check firewall status
sudo ufw status

# View Nginx logs (if using)
sudo tail -f /var/log/nginx/error.log
```

For support:
- Coolify Documentation: [https://coolify.io/docs](https://coolify.io/docs)
- Hostinger VPS Docs: [https://www.hostinger.com/tutorials/vps](https://www.hostinger.com/tutorials/vps)

## Environment Variables

- `GOOGLE_API_KEY`: Your Google API key for Gemini access

## License

MIT
