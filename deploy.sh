#!/bin/bash

echo "🚀 Deploying SISIGN to production..."

# Set production environment variables
export APP_ENV=production
export APP_URL=https://sisign.siunand.my.id
export ASSET_URL=https://sisign.siunand.my.id
export NODE_ENV=production

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build assets with production base URL
echo "🔨 Building assets..."
npm run build

# Clear Laravel caches
echo "🧹 Clearing caches..."
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Optimize for production
echo "⚡ Optimizing for production..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "✅ Deployment complete!"
echo "🌐 Access your app at: https://sisign.siunand.my.id"
