const mongoose = require('mongoose');

const machineryExpenseSchema = new mongoose.Schema(
  {
    machine: {
      type: String,
      required: [true, 'Machine name is required'],
      trim: true,
      index: true
    },
    machineId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    date: {
      type: Date,
      required: [true, 'Expense date is required'],
      default: Date.now,
      index: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Maintenance', 'Repair', 'Spare Parts', 'Purchase', 'Other'],
      default: 'Maintenance',
      index: true
    },
    desc: {
      type: String,
      required: [true, 'Description is required'],
      trim: true
    },
    qty: {
      type: Number,
      default: 1,
      min: [0.01, 'Quantity must be greater than zero']
    },
    unit: {
      type: String,
      default: 'Nos',
      trim: true
    },
    cost: {
      type: Number,
      required: [true, 'Cost is required'],
      min: [0, 'Cost cannot be negative']
    },
    subtotal: {
      type: Number,
      default: 0
    },
    includeGST: {
      type: Boolean,
      default: true
    },
    gstRate: {
      type: Number,
      default: 18
    },
    gst: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    vendor: {
      type: String,
      required: [true, 'Vendor / technician name is required'],
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
      enum: ['Paid', 'Pending', 'Overdue'],
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

machineryExpenseSchema.pre('save', function (next) {
  this.subtotal = Math.round((Number(this.qty) * Number(this.cost)) * 100) / 100;
  if (this.includeGST) {
    const rate = Number(this.gstRate) || 18;
    this.gst = Math.round(((this.subtotal * rate) / 100) * 100) / 100;
    this.total = Math.round((this.subtotal + this.gst) * 100) / 100;
  } else {
    this.gst = 0;
    this.total = this.subtotal;
  }

  if (this.status) {
    this.status = this.status.charAt(0).toUpperCase() + this.status.slice(1).toLowerCase();
  }
  next();
});

module.exports = mongoose.model('MachineryExpense', machineryExpenseSchema);
