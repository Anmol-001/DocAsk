const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('Connected to MongoDB');
  process.exit(0);
}).catch(err => {
  console.error('Failed to connect:', err);
  process.exit(1);
});
