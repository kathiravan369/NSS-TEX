const mongoose = require('mongoose');

const oilStockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Oil type is required'],
      unique: true,
      trim: true,
      index: true
    },
    stock: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative'],
      default: 0
    },
    unit: {
      type: String,
      default: 'Ltr',
      trim: true
    },
    lowStockThreshold: {
      type: Number,
      default: 50,
      min: [0, 'Threshold cannot be negative']
    },
    isLow: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

oilStockSchema.pre('save', function (next) {
  this.isLow = this.stock <= this.lowStockThreshold;
  next();
});

module.exports = mongoose.model('OilStock', oilStockSchema);
