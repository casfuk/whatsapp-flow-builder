# Meta Developer Setup Checklist

## 1. Create Facebook App
- Go to https://developers.facebook.com/apps
- Create new app → Business type
- Add "Facebook Login" product

## 2. Configure OAuth Redirect
- In App Dashboard → Facebook Login → Settings
- Add Valid OAuth Redirect URIs:
  - Local: `http://localhost:3000/api/auth/facebook/callback`
  - Production: `https://yourdomain.com/api/auth/facebook/callback`

## 3. Get Credentials
- Settings → Basic
- Copy App ID → `FACEBOOK_CLIENT_ID`
- Copy App Secret → `FACEBOOK_CLIENT_SECRET`

## 4. Request Permissions
- App Review → Permissions and Features
- Request: `pages_show_list`, `pages_read_engagement`, `leads_retrieval`
- Submit for review (requires business verification)

## 5. Test Users (before approval)
- Roles → Test Users → Add test users
- Use test users to connect during development

## 6. Environment Variables
```
FACEBOOK_CLIENT_ID=your_app_id
FACEBOOK_CLIENT_SECRET=your_app_secret
FACEBOOK_REDIRECT_URI=http://localhost:3000/api/auth/facebook/callback
```
