const newData = {
    certificate_points: 9,
    service_points: 13,
    position_points: 0,
    work_location_points: 0,
    eval_commitment: 2,
    eval_speed_accuracy: 2,
    eval_initiative: 2,
    eval_cooperation: 2,
    eval_skills_development: 2,
    project_management_points: 0,
    financial_legal_points: 0,
    committees_points: 0,
    extraordinary_points: 0,
    special_cases_points: 0,
    regular_leave_days: 0,
    sick_leave_days: 0,
    unauthorized_absence_days: 0,
    penalty_days_deduction: 0,
    is_fully_suspended: false,
    leaves_over_30_days: false,
    special_leaves_hajj_maternity: false
};

const evaluationTotal = 
            Number(newData.eval_commitment) + 
            Number(newData.eval_speed_accuracy) + 
            Number(newData.eval_initiative) + 
            Number(newData.eval_cooperation) + 
            Number(newData.eval_skills_development);

const basePoints = 
            Number(newData.certificate_points) + 
            Number(newData.service_points) + 
            Number(newData.position_points) + 
            Number(newData.work_location_points) + 
            evaluationTotal + 
            Number(newData.project_management_points) + 
            Number(newData.financial_legal_points) + 
            Number(newData.committees_points) + 
            Number(newData.extraordinary_points) + 
            Number(newData.special_cases_points);

const regularDeductDays = Math.max(0, newData.regular_leave_days - 3);
const sickDeductDays = Math.max(0, newData.sick_leave_days - 3);
const absenceDeductDays = newData.unauthorized_absence_days * 3;

const totalDeductedDays = 
            Number(newData.penalty_days_deduction) + 
            regularDeductDays + 
            sickDeductDays + 
            absenceDeductDays;

let deductions = (basePoints / 30) * totalDeductedDays;
deductions = Math.round(deductions * 100) / 100;
newData.deductions_points = deductions;

let finalPoints = basePoints - deductions;
if (newData.is_fully_suspended || newData.leaves_over_30_days || newData.special_leaves_hajj_maternity) {
    finalPoints = 0;
}

newData.total_points = Math.max(0, Math.ceil(finalPoints));
newData.deductions_points = basePoints - newData.total_points;

console.log('basePoints:', basePoints);
console.log('evaluationTotal:', evaluationTotal);
console.log('finalPoints:', finalPoints);
console.log('total_points:', newData.total_points);
console.log('deductions_points:', newData.deductions_points);
