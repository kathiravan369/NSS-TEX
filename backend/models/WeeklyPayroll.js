const mongoose = require('mongoose');

const dailyWorkRecordSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Present', 'Leave', 'HalfDay', 'Holiday', 'Off'],
    default: 'Present'
  },
  hoursWorked: {
    type: Number,
    min: 0,
    max: 24,
    default: 8
  },
  productsProduced: {
    type: Number,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
});

const weeklyPayrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    empId: {
      type: String,
      required: [true, 'Employee ID is required'],
      trim: true,
      uppercase: true,
      index: true
    },
    employeeName: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true
    },
    workType: {
      type: String,
      required: [true, 'Work type is required'],
      enum: ['DAY_SALARY', 'COUNT_SALARY', 'Day Salary', 'Count Salary', 'Count Based Salary', 'Size Based Salary', 'SIZE_SALARY'],
      default: 'Day Salary'
    },
    productName: {
      type: String,
      default: 'Towel',
      trim: true
    },
    workDate: {
      type: Date,
      default: Date.now
    },
    sizeWiseRates: [
      {
        size: { type: String, trim: true },
        rate: { type: Number, default: 0 }
      }
    ],
    sizeWiseProduction: [
      {
        size: { type: String, trim: true },
        rate: { type: Number, default: 0 },
        qty: { type: Number, default: 0 },
        amount: { type: Number, default: 0 }
      }
    ],
    weekStart: {
      type: Date,
      required: [true, 'Week start date is required'],
      index: true
    },
    weekEnd: {
      type: Date,
      required: [true, 'Week end date is required'],
      index: true
    },
    dailyRecords: [dailyWorkRecordSchema],
    daysWorked: {
      type: Number,
      min: [0, 'Days worked cannot be negative'],
      max: [7, 'Days worked cannot exceed 7 in a week'],
      default: 0
    },
    leaveDays: {
      type: Number,
      min: [0, 'Leave days cannot be negative'],
      max: [7, 'Leave days cannot exceed 7 in a week'],
      default: 0
    },
    hoursWorked: {
      type: Number,
      min: [0, 'Hours worked cannot be negative'],
      default: 0
    },
    productsProduced: {
      type: Number,
      min: [0, 'Products produced cannot be negative'],
      default: 0
    },
    pricePerItem: {
      type: Number,
      default: 0,
      min: [0, 'Price per item cannot be negative']
    },
    countQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative']
    },
    largeQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative']
    },
    largePrice: {
      type: Number,
      default: 5
    },
    mediumQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative']
    },
    mediumPrice: {
      type: Number,
      default: 4
    },
    smallQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative']
    },
    smallPrice: {
      type: Number,
      default: 3
    },
    rate: {
      type: Number,
      default: 0,
      min: [0, 'Rate cannot be negative']
    },
    grossPay: {
      type: Number,
      default: 0
    },
    deductions: {
      type: Number,
      min: [0, 'Deductions cannot be negative'],
      default: 0
    },
    adjustments: {
      type: Number,
      default: 0
    },
    netPay: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['Draft', 'Pending', 'Paid', 'DRAFT', 'PENDING', 'PAID'],
      default: 'Pending',
      index: true
    },
    paymentDate: {
      type: Date
    },
    isFinalized: {
      type: Boolean,
      default: false,
      index: true
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
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

// Compound unique index to prevent duplicate payroll records for the same employee in the same period
weeklyPayrollSchema.index({ empId: 1, weekStart: 1, weekEnd: 1 }, { unique: false });

// Pre-save validation & calculation hooks
weeklyPayrollSchema.pre('save', function (next) {
  const isDaySalary = this.workType === 'DAY_SALARY' || this.workType === 'Day Salary';
  const isSizeSalary = this.workType === 'Size Based Salary' || this.workType === 'SIZE_SALARY';

  if (isSizeSalary) {
    const lQty = Math.max(0, Number(this.largeQuantity || 0));
    const mQty = Math.max(0, Number(this.mediumQuantity || 0));
    const sQty = Math.max(0, Number(this.smallQuantity || 0));
    const lPrice = Number(this.largePrice !== undefined ? this.largePrice : 5);
    const mPrice = Number(this.mediumPrice !== undefined ? this.mediumPrice : 4);
    const sPrice = Number(this.smallPrice !== undefined ? this.smallPrice : 3);

    const sizeFormulaGross = (lQty * lPrice) + (mQty * mPrice) + (sQty * sPrice);
    if ((lQty > 0 || mQty > 0 || sQty > 0) || !Array.isArray(this.sizeWiseProduction) || this.sizeWiseProduction.length === 0) {
      this.grossPay = Math.round(sizeFormulaGross * 100) / 100;
      this.productsProduced = lQty + mQty + sQty;
    } else {
      this.grossPay = Math.round(
        this.sizeWiseProduction.reduce((sum, item) => sum + (Number(item.amount) || (Number(item.qty || 0) * Number(item.rate || 0))), 0) * 100
      ) / 100;
      this.productsProduced = this.sizeWiseProduction.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    }
  } else if (isDaySalary) {
    this.grossPay = Math.round((Number(this.daysWorked) * Number(this.rate)) * 100) / 100;
  } else {
    // Count-Based Salary
    const price = Number(this.pricePerItem !== undefined ? this.pricePerItem : this.rate) || 0;
    const qty = Math.max(0, Number(this.countQuantity !== undefined ? this.countQuantity : this.productsProduced) || 0);
    this.grossPay = Math.round((qty * price) * 100) / 100;
    this.productsProduced = qty;
    this.rate = price;
  }

  this.netPay = Math.round(
    (this.grossPay - (Number(this.deductions) || 0) + (Number(this.adjustments) || 0)) * 100
  ) / 100;

  if (this.status) {
    this.status = this.status.charAt(0).toUpperCase() + this.status.slice(1).toLowerCase();
  }

  next();
});

module.exports = mongoose.model('WeeklyPayroll', weeklyPayrollSchema);
