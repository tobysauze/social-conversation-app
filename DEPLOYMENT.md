# 🚀 Deployment Guide - Social Conversation App

This guide will help you deploy your Social Conversation App online so you can access it from any device.

## 📋 Prerequisites

- GitHub account
- Vercel account (free)
- Railway account (free)

## 🎯 Deployment Steps

### Step 1: Push to GitHub

1. **Create a new repository on GitHub**
   - Go to [github.com](https://github.com) and create a new repository
   - Name it something like `social-conversation-app`

2. **Push your code to GitHub**
   ```bash
   cd "/Users/tobysauze/Documents/code/social dev app"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/social-conversation-app.git
   git push -u origin main
   ```

### Step 2: Deploy Backend to Railway

1. **Go to [Railway.app](https://railway.app)**
   - Sign up with your GitHub account
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Configure the backend**
   - Railway will detect it's a Node.js app
   - Set the **Root Directory** to `server`
   - Add these environment variables:
     ```
     NODE_ENV=production
     JWT_SECRET=your-super-secret-jwt-key-here
     OPENAI_API_KEY=your-openai-api-key-if-you-have-one
     FRONTEND_URL=https://your-app.vercel.app
     ```

3. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Copy the generated URL (e.g., `https://your-app-production.up.railway.app`)

### Step 3: Deploy Frontend to Vercel

1. **Go to [Vercel.com](https://vercel.com)**
   - Sign up with your GitHub account
   - Click "New Project" → Import your repository

2. **Configure the frontend**
   - Set **Root Directory** to `client`
   - Add environment variable:
     ```
     REACT_APP_API_URL=https://your-app-production.up.railway.app/api
     ```
   (Replace with your actual Railway URL)

3. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Copy the generated URL (e.g., `https://your-app.vercel.app`)

### Step 4: Update Backend CORS

1. **Go back to Railway**
   - Update the `FRONTEND_URL` environment variable with your Vercel URL
   - Redeploy the backend

### Step 5: Create Demo User

1. **Access your deployed backend**
   - Go to `https://your-app-production.up.railway.app/api/health`
   - Should return `{"status":"OK"}`

2. **Create the demo user** (you can do this by calling the API or adding a script)

## 🔧 Environment Variables

### Backend (Railway)
```
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-here
OPENAI_API_KEY=your-openai-api-key-if-you-have-one
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend (Vercel)
```
REACT_APP_API_URL=https://your-app-production.up.railway.app/api
```

## 🌐 Access Your App

Once deployed, you can access your app from any device at:
- **Frontend**: `https://your-app.vercel.app`
- **Backend API**: `https://your-app-production.up.railway.app/api`

## 🔑 Login Credentials

- **Username**: `Toby`
- **Password**: `Amazon12308`

## 🛠️ Troubleshooting

### Common Issues:

1. **CORS Errors**
   - Make sure `FRONTEND_URL` in Railway matches your Vercel URL exactly

2. **API Not Found**
   - Check that `REACT_APP_API_URL` in Vercel includes `/api` at the end

3. **Database Issues**
   - Railway provides a PostgreSQL database automatically
   - The app will create tables on first run

4. **Build Failures**
   - Check the build logs in Vercel/Railway
   - Make sure all dependencies are in package.json

## 📱 Mobile Access

Your app will work on any device with a web browser:
- **iPhone/iPad**: Safari, Chrome
- **Android**: Chrome, Firefox
- **Desktop**: Chrome, Firefox, Safari, Edge

## 🔄 Updates

To update your deployed app:
1. Make changes locally
2. Push to GitHub: `git push origin main`
3. Vercel and Railway will automatically redeploy

## 💰 Costs

- **Vercel**: Free tier includes 100GB bandwidth/month
- **Railway**: Free tier includes $5 credit/month
- **Total**: $0 for personal use!

## 🎉 You're Done!

Your Social Conversation App is now live and accessible from anywhere! Share the Vercel URL with friends and family to try it out.
