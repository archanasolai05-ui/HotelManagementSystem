import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── Create Super Admin ──────────────────────────────
  const hashedPassword = await bcrypt.hash('SuperAdmin@123', 10);

  await prisma.user.upsert({
    where: { email: 'superadmin@hotel.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@hotel.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Super Admin created');

  // ── Seed all permissions ────────────────────────────
  const permissions = [
    { module: 'rooms',    action: 'create', description: 'Create a room' },
    { module: 'rooms',    action: 'read',   description: 'View rooms' },
    { module: 'rooms',    action: 'update', description: 'Update a room' },
    { module: 'rooms',    action: 'delete', description: 'Delete a room' },
    { module: 'bookings', action: 'create', description: 'Create a booking' },
    { module: 'bookings', action: 'read',   description: 'View bookings' },
    { module: 'bookings', action: 'update', description: 'Update a booking' },
    { module: 'bookings', action: 'delete', description: 'Delete a booking' },
    { module: 'billing',  action: 'create', description: 'Create invoice' },
    { module: 'billing',  action: 'read',   description: 'View billing' },
    { module: 'billing',  action: 'update', description: 'Update billing' },
    { module: 'users',    action: 'create', description: 'Create a user' },
    { module: 'users',    action: 'read',   description: 'View users' },
    { module: 'users',    action: 'update', description: 'Update a user' },
    { module: 'users',    action: 'delete', description: 'Delete a user' },
    { module: 'reports',  action: 'read',   description: 'View reports' },
    { module: 'staff',    action: 'create', description: 'Create staff' },
    { module: 'staff',    action: 'read',   description: 'View staff' },
    { module: 'staff',    action: 'update', description: 'Update staff' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: {
        module_action: {
          module: perm.module,
          action: perm.action,
        },
      },
      update: {},
      create: perm,
    });
  }

  console.log('✅ All permissions seeded');

  // ── Role permissions for ADMIN ──────────────────────
  const allPermissions = await prisma.permission.findMany();

  for (const p of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: 'ADMIN' as any,
          permissionId: p.id,
        },
      },
      update: {},
      create: {
        role: 'ADMIN' as any,
        permissionId: p.id,
        isEnabled: true,
      },
    });
  }

  console.log('✅ Admin role permissions seeded');

  // ── Role permissions for MANAGER ───────────────────
  const managerAllowed = [
    'rooms:read',
    'bookings:create',
    'bookings:read',
    'bookings:update',
    'users:read',
    'staff:read',
  ];

  for (const p of allPermissions) {
    const key = `${p.module}:${p.action}`;
    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: 'MANAGER' as any,
          permissionId: p.id,
        },
      },
      update: {},
      create: {
        role: 'MANAGER' as any,
        permissionId: p.id,
        isEnabled: managerAllowed.includes(key),
      },
    });
  }

  console.log('✅ Manager role permissions seeded');

  // ── Role permissions for USER ───────────────────────
  const userAllowed = ['rooms:read', 'bookings:read'];

  for (const p of allPermissions) {
    const key = `${p.module}:${p.action}`;
    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: 'USER' as any,
          permissionId: p.id,
        },
      },
      update: {},
      create: {
        role: 'USER' as any,
        permissionId: p.id,
        isEnabled: userAllowed.includes(key),
      },
    });
  }

  console.log('✅ User role permissions seeded');
  console.log('');
  console.log('🎉 Seed complete!');
  console.log('   Email   : superadmin@hotel.com');
  console.log('   Password: SuperAdmin@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });