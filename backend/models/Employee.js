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
      default: 'Day Salary'
    },
    workTypes: {
      type: [String],
      default: ['Day Salary']
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
    sizeRates: {
      type: [
        {
          size: { type: String, trim: true },
          rate: { type: Number, min: 0 }
        }
      ],
      default: []
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

// Normalize status before saving
employeeSchema.pre('save', function (next) {
  if (this.status === 'ACTIVE') this.status = 'Active';
  if (this.status === 'INACTIVE') this.status = 'Inactive';
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);
