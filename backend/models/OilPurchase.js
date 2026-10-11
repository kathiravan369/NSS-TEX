const mongoose = require('mongoose');

const oilPurchaseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Purchase date is required'],
      default: Date.now,
      index: true
    },
    oilType: {
      type: String,
      required: [true, 'Oil type is required'],
      trim: true,
      index: true
    },
    supplier: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true
    },
    qty: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.01, 'Quantity must be greater than zero']
    },
    unit: {
      type: String,
      default: 'Litre',
      trim: true
    },
    rate: {
      type: Number,
      required: [true, 'Rate per unit is required'],
      min: [0, 'Rate cannot be negative']
    },
    cost: {
      type: Number,
      default: 0
    },
    includeGST: {
      type: Boolean,
      default: true
    },
    gstRate: {
      type: Number,
      default: 5
    },
    gst: {
      type: Number,
      default: 0
    },
    final: {
      type: Number,
      default: 0
    },
    invoiceNo: {
      type: String,
      trim: true
    },
    dueDate: {
      type: Date,
      index: true
    },
    paidAmount: {
      type: Number,
      default: 0
    },
    balanceAmount: {
      type: Number,
      default: 0
    },
    paidAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['Paid', 'Pending', 'Overdue', 'PAID', 'PENDING', 'OVERDUE'],
      default: 'Paid',
      index: true
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

oilPurchaseSchema.pre('save', function (next) {
  this.cost = Math.round((Number(this.qty) * Number(this.rate)) * 100) / 100;
  if (this.includeGST) {
    const gstRate = Number(this.gstRate) || 5;
    this.gst = Math.round(((this.cost * gstRate) / 100) * 100) / 100;
    this.final = Math.round((this.cost + this.gst) * 100) / 100;
  } else {
    this.gst = 0;
    this.final = this.cost;
  }

  if (this.status) {
    this.status = this.status.charAt(0).toUpperCase() + this.status.slice(1).toLowerCase();
  }
  next();
});

module.exports = mongoose.model('OilPurchase', oilPurchaseSchema);
