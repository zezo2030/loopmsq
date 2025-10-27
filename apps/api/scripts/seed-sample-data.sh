#!/bin/bash

# Sample Data Seeder Script
# This script creates sample branches and halls for testing

echo "🌱 Starting Sample Data Seeder..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the API root directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found. Please create one first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the seeder
echo "🚀 Running sample data seeder..."
npm run start:dev

echo "✅ Sample data seeder completed!"
echo ""
echo "📋 Created sample data:"
echo "   - 1 Branch: الفرع الرئيسي (Main Branch)"
echo "   - 3 Halls:"
echo "     * قاعة الاحتفالات الكبرى (Grand Celebration Hall) - Capacity: 100"
echo "     * قاعة الاجتماعات (Meeting Hall) - Capacity: 50"
echo "     * قاعة الأفراح (Wedding Hall) - Capacity: 200"
echo ""
echo "🔗 You can now test the booking API with these sample data."
