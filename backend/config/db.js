const mongoose = require('mongoose');

// Helper to mask MongoDB URI for safe logging
function maskURI(uri) {
  if (!uri) return '[UNDEFINED]';
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in environment variables.');
    return false;
  }

  // Check if placeholder credentials are still present
  if (uri.includes('USERNAME:PASSWORD') || uri.includes('USERNAME@')) {
    console.warn('⚠️ MONGODB_URI contains placeholder credentials (USERNAME:PASSWORD).');
    console.warn('⚠️ Please configure your actual MongoDB Atlas database password in backend/.env');
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host} / Database: ${conn.connection.name}`);
    return true;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error(`❌ Target URI: ${maskURI(uri)}`);
    return false;
  }
};

module.exports = { connectDB, maskURI };
