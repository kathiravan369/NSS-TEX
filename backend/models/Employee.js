const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    empId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    joinDate: {
      type: Date,
      required: [true, 'Joining date is required'],
      default: Date.now
    },
    workType: {
      type: String,
      required: [true, 'Work type is required'],
      enum: {
        values: ['DAY_SALARY', 'COUNT_SALARY', 'Day Salary', 'Count Salary', 'Count Based Salary', 'Size Based Salary', 'SIZE_SALARY'],
        message: '{VALUE} is not a supported work type'
      },
      default: 'Day Salary'
    },
    dailyRate: {
      type: Number,
      min: [0, 'Daily salary rate cannot be negative'],
      default: 0
    },
    pieceRate: {
      type: Number,
      min: [0, 'Rate per product cannot be negative'],
      default: 0
    },
    productType: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'],
      default: 'Active',
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

// Normalize workType and status before saving
employeeSchema.pre('save', function (next) {
  if (this.workType === 'Day Salary') this.workType = 'DAY_SALARY';
  if (this.workType === 'Count Salary') this.workType = 'COUNT_SALARY';
  if (this.status === 'ACTIVE') this.status = 'Active';
  if (this.status === 'INACTIVE') this.status = 'Inactive';
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);
