# Development and Deployment Workflow

## Environment Details

### Local Development
- Working Directory: `/Users/soderstrom/generated_repos/gemini-screen`
- GitHub Repository: https://github.com/soderalohastrom/gemini-screen

### Production Server
- Hostinger VPS IP: 147.93.45.244
- Root Access: Yes
- Working Directory: `/home/scott/gemini-screen`
- Service Name: gemini-screen

## Standard Workflow

### 1. Local Development
```bash
# Make changes to files locally
# Test changes if possible
# Stage changes
git add <changed_files>

# Commit with descriptive message
git commit -m "Description of changes"

# Push to GitHub
git push origin main
```

### 2. Production Deployment
```bash
# SSH into VPS
ssh root@147.93.45.244

# Navigate to project directory
cd /home/scott/gemini-screen

# Pull latest changes
git pull

# Restart the service
systemctl restart gemini-screen
```

## Monitoring and Logs

### View Service Logs
```bash
# Follow service logs in real-time
ssh root@147.93.45.244 "journalctl -u gemini-screen -f"

# View Nginx error logs
ssh root@147.93.45.244 "tail -f /var/log/nginx/gemini-screen.error.log"
```

### Check Service Status
```bash
ssh root@147.93.45.244 "systemctl status gemini-screen"
```

## Quick Commands

### One-Line Deployment
```bash
# Pull and restart in one command
ssh root@147.93.45.244 "cd /home/scott/gemini-screen && git pull && systemctl restart gemini-screen"
```

### Emergency Rollback
```bash
# If needed, revert to previous commit
ssh root@147.93.45.244 "cd /home/scott/gemini-screen && git reset --hard HEAD~1 && systemctl restart gemini-screen"
```

## Service Configuration

### Service File Location
```bash
/etc/systemd/system/gemini-screen.service
```

### Nginx Configuration
```bash
/etc/nginx/sites-available/gemini-screen.nginx.conf
```

## Important Notes

1. Always check logs after deployment:
   ```bash
   ssh root@147.93.45.244 "journalctl -u gemini-screen -n 50 --no-pager"
   ```

2. Monitor Nginx errors:
   ```bash
   ssh root@147.93.45.244 "tail -n 20 /var/log/nginx/gemini-screen.error.log"
   ```

3. If service fails to start:
   ```bash
   ssh root@147.93.45.244 "systemctl status gemini-screen"
   ```

## Security Notes

- Keep this file local, do not commit to repository
- Contains sensitive information (IP, paths)
- Consider using SSH keys instead of password authentication
- Root access should be restricted in production

## Common Issues and Solutions

### Service Won't Start
```bash
# Check for syntax errors in code
ssh root@147.93.45.244 "cd /home/scott/gemini-screen && node -c *.js"

# Check service logs
ssh root@147.93.45.244 "journalctl -u gemini-screen -n 100 --no-pager"

# Verify file permissions
ssh root@147.93.45.244 "ls -la /home/scott/gemini-screen"
```

### Git Pull Fails
```bash
# Check for local changes on server
ssh root@147.93.45.244 "cd /home/scott/gemini-screen && git status"

# Force clean state if needed
ssh root@147.93.45.244 "cd /home/scott/gemini-screen && git reset --hard && git pull"
```

### Audio Issues
```bash
# Check audio processing logs
ssh root@147.93.45.244 "journalctl -u gemini-screen -f | grep 'audio'"

# Verify PCM processor is loaded
ssh root@147.93.45.244 "ls -la /home/scott/gemini-screen/pcm-processor.js"
```

## Backup Commands

### Create Quick Backup
```bash
ssh root@147.93.45.244 "cd /home/scott && tar -czf gemini-screen-backup-\$(date +%Y%m%d).tar.gz gemini-screen"
```

### Restore from Backup
```bash
ssh root@147.93.45.244 "cd /home/scott && tar -xzf gemini-screen-backup-[DATE].tar.gz"
```

Remember: This file contains sensitive information. Keep it secure and local only.