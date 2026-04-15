SELECT sp.id, sp."branchId", sp.status, sp."paymentStatus",
       u.name as staff_name, u."branchId" as staff_branch
FROM subscription_purchases sp
LEFT JOIN users u ON u.roles @> ARRAY['staff']::varchar[]
ORDER BY sp."createdAt" DESC
LIMIT 5;
