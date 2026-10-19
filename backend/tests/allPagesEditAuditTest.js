const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const { connectDB, getPool } = require('../config/db');
const {
  ThreadPurchase,
  Employee,
  WeeklyPayroll,
  ElectricityExpense,
  MachineryExpense,
  OilPurchase,
  Customer,
  Invoice
} = require('../models');

async function runAudit() {
  console.log('--- Starting All-Pages Edit Audit Test Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await connectDB();
    const pool = getPool();
    if (!pool) {
      console.error('Database connection failed. Exiting.');
      process.exit(1);
    }

    // 1. Thread Purchase (With GST)
    console.log('\n[1] Testing Thread Purchase (With GST) Edit...');
    const tpGst = await ThreadPurchase.create({
      supplier: 'Test Supplier GST',
      threadType: 'Cotton 40s',
      qty: 100,
      rate: 250,
      gstMode: 'WITH_GST',
      gstRate: 5,
      subtotal: 25000,
      gstAmount: 1250,
      total: 26250,
      paidAmount: 10000,
      balanceAmount: 16250,
      invoiceNo: `INV-GST-TEST-${Date.now()}`,
      status: 'Pending',
      notes: 'Initial test'
    });
    assert(tpGst && tpGst.id, `Created Thread Purchase (With GST) ID ${tpGst?.id}`);

    // Simulate Edit: change qty from 100 to 120 and rate to 260
    const newQty = 120;
    const newRate = 260;
    const newSubtotal = newQty * newRate; // 31200
    const newGst = (newSubtotal * 5) / 100; // 1560
    const newTotal = newSubtotal + newGst; // 32760
    const newPaid = 15000;
    const newBalance = newTotal - newPaid; // 17760

    // Test findByIdAndUpdate with numeric ID
    const updatedTpGst = await ThreadPurchase.findByIdAndUpdate(tpGst.id, {
      qty: newQty,
      rate: newRate,
      subtotal: newSubtotal,
      gstAmount: newGst,
      total: newTotal,
      paidAmount: newPaid,
      balanceAmount: newBalance,
      notes: 'Updated note via audit test'
    }, { new: true });

    assert(updatedTpGst && updatedTpGst.qty === 120, 'Updated qty persists as 120');
    assert(updatedTpGst && updatedTpGst.total === 32760, 'Updated total persists as 32760');
    assert(updatedTpGst && updatedTpGst.balanceAmount === 17760, 'Updated balanceAmount persists as 17760');

    // Test lookup by invoiceNo string in findById and findByIdAndUpdate
    const foundByInvoice = await ThreadPurchase.findById(`inv_${tpGst.invoiceNo}`);
    assert(foundByInvoice && foundByInvoice.id === tpGst.id, `Found thread purchase by inv_ invoice number`);

    // Clean up
    await ThreadPurchase.findByIdAndDelete(tpGst.id);
    const afterDelete = await ThreadPurchase.findById(tpGst.id);
    assert(!afterDelete, 'Thread purchase record cleaned up successfully');

    // 2. Thread Purchase (Without GST)
    console.log('\n[2] Testing Thread Purchase (Without GST) Edit...');
    const tpNoGst = await ThreadPurchase.create({
      supplier: 'Test Supplier No GST',
      threadType: 'Polyester 30s',
      qty: 50,
      rate: 180,
      gstMode: 'WITHOUT_GST',
      gstRate: 0,
      subtotal: 9000,
      gstAmount: 0,
      total: 9000,
      paidAmount: 9000,
      balanceAmount: 0,
      invoiceNo: `INV-NOGST-TEST-${Date.now()}`,
      status: 'Paid',
      notes: 'Initial test'
    });
    assert(tpNoGst && tpNoGst.id, `Created Thread Purchase (Without GST) ID ${tpNoGst?.id}`);

    const updatedTpNoGst = await ThreadPurchase.findByIdAndUpdate(tpNoGst.id, {
      qty: 60,
      total: 10800,
      balanceAmount: 1800,
      status: 'Pending'
    }, { new: true });
    assert(updatedTpNoGst && updatedTpNoGst.qty === 60, 'Updated qty persists as 60');
    assert(updatedTpNoGst && updatedTpNoGst.status === 'Pending', 'Updated status persists as Pending');

    await ThreadPurchase.findByIdAndDelete(tpNoGst.id);

    // 3. Weekly Payroll Edit
    console.log('\n[3] Testing Weekly Payroll Edit...');
    const payroll = await WeeklyPayroll.create({
      empId: `EMP-TEST-${Date.now()}`,
      employeeName: 'Audit Test Employee',
      workType: 'Day Salary',
      workDate: new Date(),
      weekStart: new Date(Date.now() - 6 * 24 * 3600 * 1000),
      weekEnd: new Date(),
      daysWorked: 5,
      rate: 600,
      grossPay: 3000,
      deductions: 200,
      adjustments: 0,
      netPay: 2800,
      status: 'Pending'
    });
    assert(payroll && payroll.id, `Created Weekly Payroll ID ${payroll?.id}`);

    // Update days worked to 6 and deductions to 300
    const updatedPayroll = await WeeklyPayroll.findByIdAndUpdate(payroll.id, {
      daysWorked: 6,
      grossPay: 3600,
      deductions: 300,
      netPay: 3300
    }, { new: true });
    assert(updatedPayroll && updatedPayroll.daysWorked === 6, 'Updated daysWorked persists as 6');
    assert(updatedPayroll && updatedPayroll.grossPay === 3600, 'Updated grossPay persists as 3600');
    assert(updatedPayroll && updatedPayroll.netPay === 3300, 'Updated netPay persists as 3300');

    await WeeklyPayroll.findByIdAndDelete(payroll.id);

    // 4. Employee Management Edit
    console.log('\n[4] Testing Employee Management Edit...');
    const empId = `EMP-AUDIT-${Date.now()}`;
    const emp = await Employee.create({
      empId,
      name: 'Audit Worker',
      phone: '9876543210',
      workType: 'Day Salary',
      workTypes: ['Day Salary'],
      dailyRate: 500,
      status: 'Active'
    });
    assert(emp && emp.id, `Created Employee ID ${emp?.id} (${empId})`);

    // Edit employee phone and daily rate using string empId
    const updatedEmp = await Employee.findByIdAndUpdate(empId, {
      phone: '9876543299',
      dailyRate: 550,
      notes: 'Promoted rate'
    }, { new: true });
    assert(updatedEmp && updatedEmp.phone === '9876543299', 'Updated phone persists via empId lookup');
    assert(updatedEmp && updatedEmp.dailyRate === 550, 'Updated dailyRate persists as 550');

    await Employee.findByIdAndDelete(emp.id);

    // 5. Electricity Expense Edit
    console.log('\n[5] Testing Electricity Expense Edit...');
    const elec = await ElectricityExpense.create({
      month: 'October 2026',
      prev: 1000,
      curr: 1500,
      units: 500,
      rate: 8,
      fixed: 100,
      additional: 50,
      total: 4150,
      status: 'Pending'
    });
    assert(elec && elec.id, `Created Electricity Expense ID ${elec?.id}`);

    const updatedElec = await ElectricityExpense.findByIdAndUpdate(elec.id, {
      curr: 1600,
      units: 600,
      total: 4950,
      status: 'Paid'
    }, { new: true });
    assert(updatedElec && updatedElec.units === 600, 'Updated units persists as 600');
    assert(updatedElec && updatedElec.status === 'Paid', 'Updated status persists as Paid');

    await ElectricityExpense.findByIdAndDelete(elec.id);

    // 6. Machinery Expense Edit
    console.log('\n[6] Testing Machinery Expense Edit...');
    const mcId = `MC-AUDIT-${Date.now()}`;
    const mc = await MachineryExpense.create({
      machine: 'Power Loom 1',
      machineId: mcId,
      category: 'Maintenance',
      description: 'Belt Replacement',
      qty: 2,
      cost: 1500,
      includeGST: true,
      gstRate: 18,
      gst: 270,
      total: 1770,
      status: 'Pending'
    });
    assert(mc && mc.id, `Created Machinery Expense ID ${mc?.id}`);

    const updatedMc = await MachineryExpense.findByIdAndUpdate(mcId, {
      cost: 2000,
      gst: 360,
      total: 2360,
      status: 'Paid'
    }, { new: true });
    assert(updatedMc && updatedMc.cost === 2000, 'Updated cost persists as 2000 via machineId lookup');
    assert(updatedMc && updatedMc.total === 2360, 'Updated total persists as 2360');

    await MachineryExpense.findByIdAndDelete(mc.id);

    // 7. Oil Purchase Edit
    console.log('\n[7] Testing Oil Purchase Edit...');
    const oilInv = `OIL-INV-${Date.now()}`;
    const oil = await OilPurchase.create({
      oilType: 'Spindle Oil',
      supplier: 'Apex Lubricants',
      qty: 40,
      rate: 150,
      cost: 6000,
      includeGST: true,
      gstRate: 5,
      gst: 300,
      final: 6300,
      invoiceNo: oilInv,
      status: 'Pending'
    });
    assert(oil && oil.id, `Created Oil Purchase ID ${oil?.id}`);

    const updatedOil = await OilPurchase.findByIdAndUpdate(`inv_${oilInv}`, {
      qty: 50,
      cost: 7500,
      gst: 375,
      final: 7875,
      status: 'Paid'
    }, { new: true });
    assert(updatedOil && updatedOil.qty === 50, 'Updated qty persists as 50 via invoice lookup');
    assert(updatedOil && updatedOil.final === 7875, 'Updated final persists as 7875');

    await OilPurchase.findByIdAndDelete(oil.id);

    // 8. Customer Profile Edit
    console.log('\n[8] Testing Customer Profile Edit...');
    const cusCode = `CUS-AUDIT-${Date.now()}`;
    const cust = await Customer.create({
      customerId: cusCode,
      name: 'Textile Retailers Hub',
      phone: '9123456780',
      companyName: 'TRH Corp',
      billingAddress: { city: 'Coimbatore', state: 'Tamil Nadu' }
    });
    assert(cust && cust.id, `Created Customer ID ${cust?.id} (${cusCode})`);

    const updatedCust = await Customer.findByIdAndUpdate(cusCode, {
      phone: '9123456789',
      companyName: 'TRH Enterprises Pvt Ltd'
    }, { new: true });
    assert(updatedCust && updatedCust.phone === '9123456789', 'Updated customer phone persists via customerId');
    assert(updatedCust && updatedCust.companyName === 'TRH Enterprises Pvt Ltd', 'Updated companyName persists');

    await Customer.findByIdAndDelete(cust.id);

    // 9. Invoice Edit
    console.log('\n[9] Testing Sales Invoice Edit...');
    const invNo = `INV-AUDIT-${Date.now()}`;
    const inv = await Invoice.create({
      invoiceNo: invNo,
      customerName: 'Customer A',
      subtotal: 10000,
      gstAmount: 500,
      grandTotal: 10500,
      amountPaid: 5000,
      balanceDue: 5500,
      paymentStatus: 'Partially Paid',
      invoiceStatus: 'Draft'
    });
    assert(inv && inv.id, `Created Invoice ID ${inv?.id} (${invNo})`);

    const updatedInv = await Invoice.findByIdAndUpdate(invNo, {
      grandTotal: 12000,
      amountPaid: 12000,
      balanceDue: 0,
      paymentStatus: 'Paid',
      invoiceStatus: 'Issued'
    }, { new: true });
    assert(updatedInv && updatedInv.grandTotal === 12000, 'Updated grandTotal persists via invoiceNo');
    assert(updatedInv && updatedInv.paymentStatus === 'Paid', 'Updated paymentStatus persists as Paid');

    await Invoice.findByIdAndDelete(inv.id);

    // Summary
    console.log('\n=======================================');
    console.log(`All-Pages Edit Audit Complete: ${passed} passed, ${failed} failed`);
    console.log('=======================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Audit encountered unexpected error:', err);
    process.exit(1);
  }
}

runAudit();
