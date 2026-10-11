const mongoose = require('mongoose');

const electricityExpenseSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: [true, 'Billing month is required'],
      trim: true,
      index: true
    },
    billDate: {
      type: Date,
      required: [true, 'Bill date is required'],
      default: Date.now,
      index: true
    },
    dueDate: {
      type: Date
    },
    prev: {
      type: Number,
      required: [true, 'Previous meter reading is required'],
      min: [0, 'Previous reading cannot be negative']
    },
    curr: {
      type: Number,
      required: [true, 'Current meter reading is required'],
      min: [0, 'Current reading cannot be negative']
    },
    units: {
      type: Number,
      default: 0
    },
    rate: {
      type: Number,
      required: [true, 'Rate per unit is required'],
      min: [0, 'Rate cannot be negative']
    },
    fixed: {
      type: Number,
      default: 0,
      min: [0, 'Fixed charges cannot be negative']
    },
    additional: {
      type: Number,
      default: 0,
      min: [0, 'Additional charges cannot be negative']
    },
    total: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['Paid', 'Pending', 'Overdue'],
      default: 'Pending',
      index: true
    },
    payDate: {
      type: Date
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

electricityExpenseSchema.pre('save', function (next) {
  this.units = Math.max(0, Number(this.curr) - Number(this.prev));
  this.total = Math.round(
    ((this.units * Number(this.rate)) + (Number(this.fixed) || 0) + (Number(this.additional) || 0)) * 100
  ) / 100;

  if (this.status) {
    this.status = this.status.charAt(0).toUpperCase() + this.status.slice(1).toLowerCase();
  }
  next();
});

module.exports = mongoose.model('ElectricityExpense', electricityExpenseSchema);
