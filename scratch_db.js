const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const req = await prisma.leave_requests.findUnique({where: {id: 'LR-1779418681927'}, include: {leave_approvals: true}});
  console.log(JSON.stringify(req, null, 2));
}
main().finally(() => prisma.$disconnect());
