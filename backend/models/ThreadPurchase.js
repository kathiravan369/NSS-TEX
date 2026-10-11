const mongoose = require('mongoose');

const threadPurchaseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Purchase date is required'],
      default: Date.now,
      index: true
    },
    supplier: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      index: true
    },
    threadType: {
      type: String,
      required: [true, 'Thread type is required'],
      trim: true
    },
    qty: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.01, 'Quantity must be greater than zero']
    },
    unit: {
      type: String,
      default: 'Kg',
      trim: true
    },
    rate: {
      type: Number,
      required: [true, 'Rate per unit is required'],
      min: [0, 'Rate cannot be negative']
    },
    gstMode: {
      type: String,
      enum: ['WITH_GST', 'WITHOUT_GST', 'With GST', 'Without GST'],
      default: 'WITH_GST',
      index: true
    },
    gstRate: {
      type: Number,
      min: [0, 'GST rate cannot be negative'],
      default: 0
    },
    subtotal: {
      type: Number,
      default: 0
    },
    gstAmount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    invoiceNo: {
      type: String,
      trim: true,
      index: true
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

// Server-side financial calculations before save
threadPurchaseSchema.pre('save', function (next) {
  // Normalize gstMode
  if (this.gstMode === 'With GST') this.gstMode = 'WITH_GST';
  if (this.gstMode === 'Without GST') this.gstMode = 'WITHOUT_GST';

  // Compute Subtotal = Qty * Rate
  this.subtotal = Math.round((Number(this.qty) * Number(this.rate)) * 100) / 100;

  if (this.gstMode === 'WITH_GST') {
    const ratePct = Number(this.gstRate) || 0;
    this.gstAmount = Math.round(((this.subtotal * ratePct) / 100) * 100) / 100;
    this.total = Math.round((this.subtotal + this.gstAmount) * 100) / 100;
  } else {
    this.gstRate = 0;
    this.gstAmount = 0;
    this.total = this.subtotal;
  }

  // Normalize status
  if (this.status) {
    this.status = this.status.charAt(0).toUpperCase() + this.status.slice(1).toLowerCase();
  }

  next();
});

module.exports = mongoose.model('ThreadPurchase', threadPurchaseSchema);
